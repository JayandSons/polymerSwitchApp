### TEMP: Codeship commands

Setup commands

```
echo machine github.com login ${GITHUB_SERVICE_ACCOUNT_USERNAME}{GITHUB_SERVICE_ACCOUNT_TOKEN} >> ~/.netrc
# Now we are able to clone
nvm install v8.1.2
node -v
npm install -g firebase-tools bower polymer-cli
```

Deploy - Custom Scripts
```
bower install -F
polymer build
git clone https://github.com/ArcadeCity/firebase-app.git
mv build/default firebase-app/public
cd firebase-app
firebase deploy --only hosting --token "$FIREBASE_TOKEN"
```

Tokens
FIREBASE_TOKEN
GITHUB_SERVICE_ACCOUNT_USERNAME
GITHUB_SERVICE_ACCOUNT_TOKEN

