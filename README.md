# hubjs

Provides loosely coupled sandboxes for your JavaScript apps.

```js
Hub.use(async ({ log, request }) => {
  const { ok, response } = await request.json("user.json"); // { "who": "World" }
  if (ok) {
    log(`Hello, ${response.who}!`);
  } else {
    log.error("Could not load 'user.json'");
  }
});
```
