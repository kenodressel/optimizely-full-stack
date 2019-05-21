# optimizely-full-stack

How to use this app:
```
npm i && node index.js
```

Routes:
```
GET '/' --> Shows if a userID is saved in the session with "Hello ${userID}"
```

```
POST '/set/user', body: { "userID": String } --> Sets userID to session
```

```
GET '/ab', body: { "userID": String, "gender": "m" or "f" } --> activates ab test and shows variation
```

```
GET '/feature', body { "userID": String, "gender": "m" or "f" } --> activates feature test and shows feature value
```

```
GET '/rollout', body { "userID": String, "gender": "m" or "f" } --> activates feature rollout and shows feature value
```
