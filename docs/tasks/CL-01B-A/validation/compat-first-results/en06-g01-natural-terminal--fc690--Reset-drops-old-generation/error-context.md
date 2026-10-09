# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: en06-g01.spec.ts >> natural terminal gate freezes on pause, advances at wheel .1, and Reset drops old generation
- Location: tests\en06-g01.spec.ts:13:1

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'state')
    at eval (eval at evaluate (:311:30), <anonymous>:1:24)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- main [ref=f1e1]
```