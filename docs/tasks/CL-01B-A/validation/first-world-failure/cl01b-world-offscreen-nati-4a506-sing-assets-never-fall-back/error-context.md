# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cl01b-world.spec.ts >> offscreen native skeleton leases release and ordinary missing assets never fall back
- Location: tests\cl01b-world.spec.ts:21:1

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'state')
    at eval (eval at evaluate (:311:30), <anonymous>:1:24)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- main [ref=e1]
```