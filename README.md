# Desktop notifications for DeepSeek Harness

Sends one system notification when a turn finishes, or when a question or approval is waiting, but only while the DSH window is not in the foreground. Clicking the notification brings DSH forward and opens the Session that produced it.

## Requirements

- DeepSeek Harness Desktop `0.2.3-alpha.2` or a later `0.2.x`
- Notification permission for DeepSeek Harness in your system settings

## Install

In DSH Desktop, open **Plugins**, choose **Add plugin**, and enter the repository:

```text
github:RokyZevon/dsh-desktop-notify
```

Or, with the `dsh` CLI on your `PATH`:

```bash
dsh plugin --profile desktop add 'github:RokyZevon/dsh-desktop-notify'
```

This installs the default branch (`main`) at the time of installation. DSH does not offer in-place updates for Git installs; to update, remove the bundle and install it again.

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
