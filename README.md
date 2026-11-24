# Desktop notifications for DeepSeek Harness

Sends one system notification when a turn finishes, or when a question or approval is waiting, but only while the DSH window is not in the foreground. Clicking the notification brings DSH forward and opens the Session that produced it.

## Requirements

- DeepSeek Harness Desktop `0.2.3-alpha.2` or a later `0.2.x`
- Notification permission for DeepSeek Harness in your system settings

## Install

In DSH Desktop, open **Plugins**, choose **Add plugin**, and enter a commit-pinned Git address:

```text
github:RokyZevon/dsh-desktop-notify#<40-character commit>
```

Or, with the `dsh` CLI on your `PATH`:

```bash
dsh plugin --profile desktop add 'github:RokyZevon/dsh-desktop-notify#<40-character commit>'
```

Use a full commit SHA. A tag or branch name also installs, but DSH cannot update such an installation in place.

## Behavior

- One notification per finished turn; a pending question or approval gets its own notification.
- Silent while the DSH window is in the foreground.
- Subagent sessions do not notify.
- Clicking focuses DSH and opens the originating Session.
- No data leaves the machine, and the bundle keeps no diagnostic log.

## Platforms

The bundle does not restrict the Host platform. It uses the standard Web Notification API in the DSH renderer, so it runs wherever DSH Desktop runs. Windows shows notifications as system toasts; make sure notifications are enabled for DeepSeek Harness in Windows Settings.

## Development

This repository is the installed package. Link it into a profile with **Plugins → Add plugin → absolute directory**, then edit `client.js` or `index.js`; Client HMR updates an open page.

## License

MIT
