# javaobj-js
ObjectInputStream for JavaScript. Equivalent to Python's javaobj-py3.

# Limitations

The following features are not implemented. If you desparately need them, please open an issue, and ideally a PR.

- Proxy classes
- Exceptions in stream. This refers to TC_EXCEPTION - you can still readObject throwable objects
- Strings longer than Number.MAX_SAFE_INTEGER (2**53 - 1) bytes
