# Signed release APK setup

The repository can build a debug APK automatically. A signed release APK needs a private Android keystore. Do not commit the keystore or passwords to this repository.

## 1. Create a keystore on your own computer

Install a JDK, then run:

```bash
keytool -genkeypair -v -keystore chess-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias chess
```

Keep `chess-release.jks` and its passwords in a safe place. Losing this key can prevent future updates from being installed over this release.

## 2. Convert the keystore to Base64

Linux/macOS:

```bash
base64 -w 0 chess-release.jks
```

On macOS, use `base64 chess-release.jks | tr -d '\n'`.

## 3. Add GitHub Actions secrets

In the repository, open Settings → Secrets and variables → Actions → New repository secret. Add:

- `ANDROID_KEYSTORE_BASE64`: the Base64 output from step 2
- `ANDROID_KEYSTORE_PASSWORD`: the keystore password
- `ANDROID_KEY_ALIAS`: `chess` (or the alias you chose)
- `ANDROID_KEY_PASSWORD`: the key password

## 4. Enable the release workflow

In Settings → Secrets and variables → Actions → Variables, add a repository variable:

- Name: `RELEASE_SIGNING_ENABLED`
- Value: `true`

Then open Actions → Build Android APK → Run workflow. The workflow builds a debug APK and, when signing is enabled, a signed release APK.

Never send the keystore or its passwords in chat or commit them to Git.
