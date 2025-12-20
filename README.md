# javaobj-js

ObjectInputStream for JavaScript. Similar to Python's javaobj-py3.

## Limitations

The following features are not implemented. If you desparately need them, please open an issue, and ideally a PR.

- Proxy classes
- Exceptions in stream. This refers to TC_EXCEPTION - you can still readObject throwable objects
- Strings longer than Number.MAX_SAFE_INTEGER (2**53 - 1) bytes

## TODO

- [ ] all tests
- [ ] ensure eof is always handled
- [ ] when reading a primitive and next content is an object, make sure it doesn't read it (add to tests)
- [ ] better enum handling
- [ ] test and/or improve classDesc and class handling
- [ ] handle proxy classes
- [ ] handle exceptions
- [ ] emit AST
- [ ] error when unmatching serialVersionUID
