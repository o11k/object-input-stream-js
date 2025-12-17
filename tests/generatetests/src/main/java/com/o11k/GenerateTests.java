package com.o11k;

import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.stream.Collectors;

class Randomizer {
    static final float CHANCE_NAN = 0.05f;
    static final float CHANCE_INFINITY = 0.05f;
    static final float CHANCE_SUBNORMAL = 0.05f;
    static final float CHANCE_ZERO = 0.05f;

    static byte nextByte(Random rnd) { byte[] bs = {0}; rnd.nextBytes(bs); return bs[0]; }
    static char nextChar(Random rnd) { return (char)rnd.nextInt(1 << 16); }
    static double nextDouble(Random rnd) {
        long dBits = rnd.nextLong();
        final long dExponentMask = 0b0__1111_1111_111__0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000L;
        final long dFractionMask = 0b0__0000_0000_000__1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111L;
        final float choice = rnd.nextFloat();
        if (choice < (CHANCE_NAN)) {
            dBits |= dExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY)) {
            dBits |= dExponentMask;
            dBits &= ~dFractionMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL)) {
            dBits &= ~dExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL + CHANCE_ZERO)) {
            dBits &= ~dExponentMask;
            dBits &= ~dFractionMask;
        }
        return Double.longBitsToDouble(dBits);
    }
    static float nextFloat(Random rnd) {
        int fBits = rnd.nextInt();
        final int fExponentMask = 0b0__1111_1111__0000_0000_0000_0000_0000_000;
        final int fFractionMask = 0b0__0000_0000__1111_1111_1111_1111_1111_111;
        final float choice = rnd.nextFloat();
        if (choice < (CHANCE_NAN)) {
            fBits |= fExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY)) {
            fBits |= fExponentMask;
            fBits &= ~fFractionMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL)) {
            fBits &= ~fExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL + CHANCE_ZERO)) {
            fBits &= ~fExponentMask;
            fBits &= ~fFractionMask;
        }
        return Float.intBitsToFloat(fBits);
    }
    static int nextInt(Random rnd) { return rnd.nextInt(); }
    static long nextLong(Random rnd) { return rnd.nextLong(); }
    static short nextShort(Random rnd) { return (short)rnd.nextInt(1 << 16); }
    static boolean nextBoolean(Random rnd) { return rnd.nextBoolean(); }

    static String nextString(Random rnd) { return UUID.randomUUID().toString(); }  // TODO

    static <T> T nextObject(Random rnd, Class<T> clazz) throws Exception {
        T obj = clazz.getDeclaredConstructor().newInstance();

        for (Field f : clazz.getDeclaredFields()) {
            f.setAccessible(true);

            Class<?> type = f.getType();
            if (type == byte.class || type == Byte.class) {
                f.set(obj, nextByte(rnd));
            } else if (type == char.class || type == Character.class) {
                f.set(obj, nextChar(rnd));
            } else if (type == double.class || type == Double.class) {
                f.set(obj, nextDouble(rnd));
            } else if (type == float.class || type == Float.class) {
                f.set(obj, nextFloat(rnd));
            } else if (type == int.class || type == Integer.class) {
                f.set(obj, nextInt(rnd));
            } else if (type == long.class || type == Long.class) {
                f.set(obj, nextLong(rnd));
            } else if (type == short.class || type == Short.class) {
                f.set(obj, nextShort(rnd));
            } else if (type == boolean.class || type == Boolean.class) {
                f.set(obj, nextBoolean(rnd));
            } else if (!type.isPrimitive()) {
                // recursively fill nested object
                f.set(obj, nextObject(rnd, type));
            }
        }

        return obj;
    }
}

class ToJS {
    static boolean isPrintable(char c) {
        switch (Character.getType(c)) {
            case Character.LOWERCASE_LETTER:
            case Character.MODIFIER_LETTER:
            case Character.OTHER_LETTER:
            case Character.TITLECASE_LETTER:
            case Character.UPPERCASE_LETTER:

            case Character.COMBINING_SPACING_MARK:
            case Character.ENCLOSING_MARK:
            case Character.NON_SPACING_MARK:

            case Character.DECIMAL_DIGIT_NUMBER:
            case Character.LETTER_NUMBER:
            case Character.OTHER_NUMBER:

            case Character.CONNECTOR_PUNCTUATION:
            case Character.DASH_PUNCTUATION:
            case Character.END_PUNCTUATION:
            case Character.FINAL_QUOTE_PUNCTUATION:
            case Character.INITIAL_QUOTE_PUNCTUATION:
            case Character.OTHER_PUNCTUATION:
            case Character.START_PUNCTUATION:

            case Character.CURRENCY_SYMBOL:
            case Character.MODIFIER_SYMBOL:
            case Character.MATH_SYMBOL:
            case Character.OTHER_SYMBOL:
                return true;

            default:
                return false;
        }
    }

    static String charToJS(char c) {
        switch (c) {
            case '"':  return "\\\"";
            case '\'': return "\\'";
            case '\b': return "\\b";
            case '\f': return "\\f";
            case '\n': return "\\n";
            case '\r': return "\\r";
            case '\t': return "\\t";
            case '\\': return "\\\\";
        }

        if (isPrintable(c))
            return Character.toString(c);

        // JSON Unicode escape
        return String.format("\\u%04x", (int)c);
    }

    static String toJs(Object obj) throws Exception {
        if (obj instanceof Byte)      return obj.toString();
        if (obj instanceof Character) return "'" + charToJS((Character)obj) + "'";
        if (obj instanceof Double)    return obj.toString();
        if (obj instanceof Float)     return Double.toString(((Float)obj).doubleValue());
        if (obj instanceof Integer)   return obj.toString();
        if (obj instanceof Long)      return obj.toString() + "n";
        if (obj instanceof Short)     return obj.toString();
        if (obj instanceof Boolean)   return obj.toString();

        if (obj instanceof String) return '"' + ((String)obj).chars().mapToObj(c -> charToJS((char)c)).collect(Collectors.joining()) + '"';

        String result = "";

        result += "{";
        Field[] fields = obj.getClass().getDeclaredFields();
        for (Field field : fields) {
            result += toJs(field.getName()) + ":" + toJs(field.get(obj)) + ",";
        }
        result += "}";

        return result;

    }
}


public class GenerateTests {
    static final float CHANCE_PRIMITIVE = 0.50f;

    static final int NUM_ITEMS_TO_WRITE = 10_000;

    static final String PATH_DIR = "tests/tmp";
    static final String PATH_TXT = PATH_DIR + "/expected.txt";
    static final String PATH_SER = PATH_DIR + "/serialized.ser";


    static void writePrimitive(Random rnd, FileWriter outExpected, ObjectOutputStream oos) throws Exception {
        final char[] typecodes = {'B', 'C', 'D', 'F', 'I', 'J', 'S', 'Z'};
        char typecode = typecodes[rnd.nextInt(typecodes.length)];

        switch (typecode) {
            case 'B':
                final byte b = Randomizer.nextByte(rnd);
                oos.writeByte(b);
                outExpected.write(typecode + ToJS.toJs(b) + '\n');
                break;
            case 'C':
                final char c = Randomizer.nextChar(rnd);
                oos.writeChar(c);
                outExpected.write(typecode + ToJS.toJs(c) + '\n');
                break;
            case 'D':
                final double d = Randomizer.nextDouble(rnd);
                oos.writeDouble(d);
                outExpected.write(typecode + ToJS.toJs(d) + '\n');
                break;
            case 'F':
                final float f = Randomizer.nextFloat(rnd);
                oos.writeFloat(f);
                outExpected.write(typecode + ToJS.toJs(f) + '\n');
                break;
            case 'I':
                final int i_ = Randomizer.nextInt(rnd);
                oos.writeInt(i_);
                outExpected.write(typecode + ToJS.toJs(i_) + '\n');
                break;
            case 'J':
                final long l = Randomizer.nextLong(rnd);
                oos.writeLong(l);
                outExpected.write(typecode + ToJS.toJs(l) + '\n');
                break;
            case 'S':
                final short s = Randomizer.nextShort(rnd);
                oos.writeShort(s);
                outExpected.write(typecode + ToJS.toJs(s) + '\n');
                break;
            case 'Z':
                final boolean z = Randomizer.nextBoolean(rnd);
                oos.writeBoolean(z);
                outExpected.write(typecode + ToJS.toJs(z) + '\n');
                break;
            default:
                throw new Exception("Unexpected typecode: " + typecode);
        }
    }

    static class A implements Serializable {
        byte b;
        char c;
        double d;
        float f;
        int i;
        long j;
        short s;
        boolean z;
    }

    static void writeObject(Random rnd, FileWriter outExpected, ObjectOutputStream oos) throws Exception {
        A obj = new A();
        obj.b = Randomizer.nextByte(rnd);
        obj.c = Randomizer.nextChar(rnd);
        obj.d = Randomizer.nextDouble(rnd);
        obj.f = Randomizer.nextFloat(rnd);
        obj.i = Randomizer.nextInt(rnd);
        obj.j = Randomizer.nextLong(rnd);
        obj.s = Randomizer.nextShort(rnd);
        obj.z = Randomizer.nextBoolean(rnd);

        outExpected.write("L" + ToJS.toJs(obj) + "\n");
        oos.writeObject(obj);
    }

    static final String PRIMITIVES_FILENAME = "primitives";
    static void genPrimitives() throws Exception {
        final FileOutputStream outSerialized = new FileOutputStream(PATH_DIR + "/" + PRIMITIVES_FILENAME + ".ser");
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);

        oos.writeByte(69);
        oos.writeChar('✔');
        oos.writeDouble(420e69);
        oos.writeFloat(-9e30f);
        oos.writeInt(420 * 69);
        oos.writeLong(420L << (6*9));
        oos.writeShort(-12345);
        oos.writeBoolean(true);

        oos.close();
        outSerialized.close();
    }

    static final String FLOATS_FILENAME = "floats";
    static void genFloats() throws Exception {
        final FileOutputStream outSerialized = new FileOutputStream(PATH_DIR + "/" + FLOATS_FILENAME + ".ser");
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);

        oos.writeFloat(0.5f);
        oos.writeFloat(1_000_000f);
        oos.writeFloat(0.0f);
        oos.writeFloat(-0.0f);
        oos.writeFloat(Float.POSITIVE_INFINITY);
        oos.writeFloat(Float.NEGATIVE_INFINITY);
        oos.writeFloat(Float.NaN);
        oos.writeFloat(1e-40f);

        oos.writeDouble(0.5d);
        oos.writeDouble(1_000_000d);
        oos.writeDouble(0.0d);
        oos.writeDouble(-0.0d);
        oos.writeDouble(Double.POSITIVE_INFINITY);
        oos.writeDouble(Double.NEGATIVE_INFINITY);
        oos.writeDouble(Double.NaN);
        oos.writeDouble(1e-310d);

        oos.close();
        outSerialized.close();
    }

    static final String INT_LIMITS_FILENAME = "int-limits";
    static void genIntLimits() throws Exception {
        final FileOutputStream outSerialized = new FileOutputStream(PATH_DIR + "/" + INT_LIMITS_FILENAME + ".ser");
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);

        oos.writeByte(-1);
        oos.writeByte(0);
        oos.writeByte(1);
        oos.writeByte(Byte.MIN_VALUE);
        oos.writeByte(Byte.MAX_VALUE);

        oos.writeChar(0);
        oos.writeChar(Character.MIN_VALUE);
        oos.writeChar(Character.MAX_VALUE);
        oos.writeChar(Character.MIN_LOW_SURROGATE);
        oos.writeChar(Character.MAX_LOW_SURROGATE);
        oos.writeChar(Character.MIN_HIGH_SURROGATE);
        oos.writeChar(Character.MAX_HIGH_SURROGATE);

        oos.writeInt(-1);
        oos.writeInt(0);
        oos.writeInt(1);
        oos.writeInt(Integer.MIN_VALUE);
        oos.writeInt(Integer.MAX_VALUE);

        oos.writeLong(-1L);
        oos.writeLong(0L);
        oos.writeLong(1L);
        oos.writeLong(Long.MIN_VALUE);
        oos.writeLong(Long.MAX_VALUE);

        oos.writeShort(-1);
        oos.writeShort(0);
        oos.writeShort(1);
        oos.writeShort(Short.MIN_VALUE);
        oos.writeShort(Short.MAX_VALUE);

        oos.close();
        outSerialized.close();
    }

    public static void main(String[] args) throws Exception {
        genPrimitives();
        genFloats();
        genIntLimits();
        if (true) return;

        new File(PATH_DIR).mkdirs();
        final FileWriter outExpected = new FileWriter(PATH_TXT);
        final FileOutputStream outSerialized = new FileOutputStream(PATH_SER);
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);
        final Random rnd = new Random();

        for (int i=0; i<NUM_ITEMS_TO_WRITE; i++) {
            final float choice = rnd.nextFloat();
            if (choice < CHANCE_PRIMITIVE) {
                writePrimitive(rnd, outExpected, oos);
            } else {
                writeObject(rnd, outExpected, oos);
            }
        }

        oos.close();
        outSerialized.close();
        outExpected.close();
    }
}
