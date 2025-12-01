# javaobj-js
ObjectInputStream for JavaScript. Equivalent to Python's javaobj-py3.

## Limitations

Not possible even in threory:

- Unless provided a handler, cannot parse externalizable objects from `PROTOCOL_VERSION_1`.
- Unless provided a handler, cannot parse serializable objects whose writeObject method doesn't write the class' fields in the expected format.

Unlikely to be implemented:

- Parsing proxy classes
