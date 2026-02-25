# konduit-app

## Devel

In order to serve the app in a devel mode:

```
$ yarn dev
```

## TS config files

We have fource different tsconfig files:

- `tsconfig.json`: base config file which also references the other three
- `tsconfig.app.json`: config file for the app code which emits to dist
- `tsconfig.test.json`: config file for the test code which does not emit and is used by vitest
- `tsconfig.config.json`: config file for the vite config files which does not emit

Please do note that inheritance in tsconfig files has some quirks, for example `references` do not inherit (could cause circular referencing) so dependencies should be listed explicitly in each file.

### Testing on an Android device

If you want to preview the PWA on your Android device from the local network you should rather use:

```
$ vite --host 0.0.0.0
```

And then enable the PWA through the browser prompt:

* Open the Chrome app on your Android device.
* In the address bar, type chrome://flags and press Enter.
* Search for "Insecure origins treated as secure" (the internal name is #unsafely-treat-insecure-origin-as-secure).
* Enable the flag.
* In the provided text box, enter the specific HTTP origin for your local server (e.g., http://localhost:3000 or http://192.168.1.100:8080, depending on how you're serving it). You can add multiple origins separated by commas if needed.
* Tap "Relaunch" to restart Chrome and apply the changes.

