/**
 * Browser half of the desktop-notify bundle.
 *
 * DSH Desktop's Host runs as a separate Node child process, so only the
 * renderer can show a system notification. This half watches two signals in the
 * page:
 *
 *  - the main session's durable event source for `turn/end` (one notification
 *    per turn), and
 *  - `uiSession.sessionStatus` for a newly published pending interaction
 *    (approval or user question) and for background sessions that stop running.
 *
 * It stays silent while the DSH window is in the foreground, and sends one
 * system notification otherwise. Clicking the notification asks the renderer
 * window to focus itself and opens the Session that produced it.
 */
window.__ModuleLoader__.load({
  id: '@rokyzevon/dsh-desktop-notify',
  factory() {
    /** Locale namespace for the notification copy. */
    const NS = 'desktop-notify';
    /** Longest session title embedded in a notification body. */
    const MAX_TITLE = 80;
    /** Notification copy; the active DSH locale picks the dictionary. */
    const ZH = {
      'title': 'DSH',
      'turn.completed': '「{title}」本轮已完成',
      'turn.error': '「{title}」本轮在出错后结束',
      'turn.interrupted': '「{title}」本轮已中断',
      'session.untitled': '未命名会话',
      'pending.approval': '「{title}」有操作等待你审批',
      'pending.question': '「{title}」有提问等待你回答',
      'pending.generic': '「{title}」有提问或审批等待你处理',
    };
    const EN = {
      'title': 'DSH',
      'turn.completed': '"{title}" finished this turn',
      'turn.error': '"{title}" ended with an error',
      'turn.interrupted': '"{title}" was interrupted',
      'session.untitled': 'Untitled session',
      'pending.approval': '"{title}" is waiting for your approval',
      'pending.question': '"{title}" has a question for you',
      'pending.generic': '"{title}" is waiting for your input',
    };

    /** Current Web Notification capability facts. */
    function notificationFacts() {
      if (typeof globalThis.Notification !== 'function') {
        return { supported: false, permission: 'unavailable' };
      }
      let permission = 'unknown';
      try {
        permission = globalThis.Notification.permission;
      } catch {
        // Keep the unknown marker.
      }
      return { supported: true, permission };
    }

    /** Read the live permission each time; the OS can change it at any point. */
    function currentPermission() {
      try {
        return globalThis.Notification?.permission ?? 'unavailable';
      } catch {
        return 'unknown';
      }
    }

    /** True when the DSH window is visible and focused. */
    function isForeground() {
      try {
        return document.visibilityState === 'visible' && document.hasFocus();
      } catch {
        return false;
      }
    }

    /** Short display title for one session, or an empty string. */
    function sessionLabel(sessions, sessionId) {
      try {
        const row = sessions.list.getSnapshot().byId?.[sessionId];
        const title = typeof row?.displayTitle === 'string' ? row.displayTitle.trim() : '';
        return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE)}…` : title;
      } catch {
        return '';
      }
    }

    /** Subagent sessions are internal child runs; their boundaries are noise. */
    function isSubagent(sessions, sessionId) {
      try {
        const row = sessions.list.getSnapshot().byId?.[sessionId];
        return row?.origin === 'subagent' || row?.parentId !== undefined;
      } catch {
        return false;
      }
    }

    /** Highest durable event sequence present in one loaded session window. */
    function highestSeq(windowSnapshot) {
      let highest = 0;
      for (const entry of windowSnapshot?.entries ?? []) {
        if (entry?.type !== 'event') continue;
        const seq = entry.event?.seq;
        if (typeof seq === 'number' && seq > highest) highest = seq;
      }
      return highest;
    }

    return {
      inject: ['sessions', 'uiSession', 'uiSession.sessionStatus', 'uiWorkspace', 'locale'],
      apply(ctx) {
        const sessions = ctx.sessions;
        const uiSession = ctx.uiSession;
        const uiWorkspace = ctx.uiWorkspace;
        const facts = notificationFacts();
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'desktop-notify: dictionaries');
        const t = ctx.locale.bind(NS);

        let disposed = false;
        let bindingDisposer = null;
        let boundSessionId;
        let boundBinding;
        let mainSessionId;
        let lastSeq = 0;
        let statusReady = false;
        let previousStatus = new Map();
        const activeNotifications = new Set();

        /** Keep the most recent wrappers alive so a late click can still be dispatched. */
        function remember(notification) {
          activeNotifications.add(notification);
          while (activeNotifications.size > 24) {
            const oldest = activeNotifications.values().next().value;
            activeNotifications.delete(oldest);
            try {
              oldest.close();
            } catch {
              // Already dismissed.
            }
          }
        }

        /** Close every notification this half still owns. */
        function closeNotifications() {
          for (const notification of activeNotifications) {
            try {
              notification.close();
            } catch {
              // Already dismissed.
            }
          }
          activeNotifications.clear();
        }

        /** Ask the window to come forward; renderer-only, best effort. */
        function requestFocus() {
          try {
            window.focus();
          } catch {
            // Renderer focus is best effort.
          }
          setTimeout(() => {
            try {
              window.focus();
            } catch {
              // The first attempt already failed.
            }
          }, 400);
        }

        /** Show at most one notification for one concrete event. */
        function notify(kind, sessionId, detail) {
          if (disposed) return;
          const event = kind === 'turn' ? 'turn' : 'pending';
          if (!facts.supported || currentPermission() === 'denied') return;
          if (isForeground()) return;
          const label = sessionLabel(sessions, sessionId) || t('session.untitled');
          const title = t('title');
          const pendingKey = detail?.pendingKind === 'approval'
            ? 'pending.approval'
            : detail?.pendingKind === 'question' || detail?.pendingKind === 'plan-review'
              ? 'pending.question'
              : 'pending.generic';
          const turnKey = detail?.turnReason === 'error'
            ? 'turn.error'
            : detail?.turnReason === 'interrupted'
              ? 'turn.interrupted'
              : 'turn.completed';
          const body = event === 'turn'
            ? t(turnKey, { title: label })
            : t(pendingKey, { title: label });
          const tag = `desktop-notify:${event}:${sessionId ?? 'none'}`;
          try {
            const notification = new globalThis.Notification(title, { body, silent: true, tag });
            remember(notification);
            notification.onclick = () => {
              if (typeof sessionId === 'string' && sessionId !== '') {
                try {
                  uiWorkspace.openSession(sessionId);
                } catch {
                  // Navigation is best effort; focus still applies.
                }
              }
              requestFocus();
              try {
                notification.close();
              } catch {
                // Already dismissed.
              }
            };
          } catch {
            // The OS can refuse construction when notifications are blocked.
          }
        }

        /** Reframe the main session's durable window whenever it changes. */
        function syncMain() {
          if (disposed) return;
          let snapshot;
          try {
            snapshot = sessions.list.getSnapshot();
          } catch {
            return;
          }
          const rows = snapshot?.byId ?? {};
          // Several visual sessions can retain the main view at once. Stay on the
          // current one while it is still retained (the same stickiness ui-session
          // uses) so list reordering cannot flap the subscription.
          const currentRow = boundSessionId === undefined ? undefined : rows[boundSessionId];
          const keepCurrent = (currentRow?.retainedBy?.mainView ?? 0) > 0;
          const main = keepCurrent ? currentRow : Object.values(rows).find((row) => (row?.retainedBy?.mainView ?? 0) > 0);
          const nextId = main?.id;
          let binding;
          if (nextId !== undefined) {
            try {
              binding = sessions.binding(nextId);
            } catch {
              binding = undefined;
            }
          }
          // A reconnect can replace the Session binding while the visible id stays
          // the same, so compare the binding object, not only the session id.
          if (nextId === boundSessionId && binding === boundBinding) return;
          if (bindingDisposer !== null) {
            try {
              bindingDisposer();
            } catch {
              // The binding is already gone.
            }
            bindingDisposer = null;
          }
          boundSessionId = nextId;
          boundBinding = binding;
          mainSessionId = nextId;
          lastSeq = 0;
          if (binding === undefined) return;
          const source = binding.eventSource;
          lastSeq = highestSeq(source.getSnapshot());
          bindingDisposer = source.subscribe(() => {
            if (disposed) return;
            const windowSnapshot = source.getSnapshot();
            const change = windowSnapshot?.change;
            if (change?.kind !== 'append') {
              // Replacement windows carry history or reconnect repair, never a
              // fresh turn boundary worth announcing.
              lastSeq = Math.max(lastSeq, highestSeq(windowSnapshot));
              return;
            }
            for (const entry of change.entries ?? []) {
              if (entry?.type !== 'event') continue;
              const event = entry.event;
              if (typeof event?.seq !== 'number' || event.seq <= lastSeq) continue;
              lastSeq = event.seq;
              if (event.type !== 'turn/end') continue;
              const reason = event.data?.reason?.kind;
              if (reason === 'aborted') continue;
              if (isSubagent(sessions, nextId)) continue;
              notify('turn', nextId, { turn: event.data?.turn, turnReason: reason });
            }
          });
        }

        /** Watch pending interactions and background-session completions. */
        function onStatus() {
          if (disposed) return;
          let snapshot;
          try {
            snapshot = uiSession.sessionStatus.getSnapshot();
          } catch {
            return;
          }
          if (!(snapshot instanceof Map)) return;
          if (!statusReady) {
            statusReady = true;
            previousStatus = new Map(snapshot);
            return;
          }
          const next = new Map(snapshot);
          for (const [sessionId, status] of next) {
            if (isSubagent(sessions, sessionId)) continue;
            const previous = previousStatus.get(sessionId);
            const pending = status?.pendingInteraction;
            if (pending !== undefined && pending !== null && pending !== previous?.pendingInteraction) {
              notify('pending', sessionId, { pendingKind: typeof pending.kind === 'string' ? pending.kind : 'interaction' });
            }
            // The main session uses its per-turn event source instead, so a
            // status change there cannot duplicate a turn notification.
            if (sessionId !== mainSessionId && previous?.running === true && status?.running === false) {
              notify('turn', sessionId, { turn: null, turnReason: 'idle' });
            }
          }
          previousStatus = next;
        }

        ctx.effect(() => {
          const unsubscribeList = sessions.list.subscribe(syncMain);
          const unsubscribeStatus = uiSession.sessionStatus.subscribe(onStatus);
          syncMain();
          onStatus();
          return () => {
            disposed = true;
            try {
              bindingDisposer?.();
            } catch {
              // Already disposed.
            }
            bindingDisposer = null;
            try {
              unsubscribeList();
            } catch {
              // Already disposed.
            }
            try {
              unsubscribeStatus();
            } catch {
              // Already disposed.
            }
            closeNotifications();
          };
        }, 'desktop-notify: notifications');
      },
    };
  },
});
