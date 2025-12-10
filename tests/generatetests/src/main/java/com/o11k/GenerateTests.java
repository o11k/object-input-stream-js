package com.o11k;

import java.io.*;
import java.util.*;

public class GenerateTests {
    static byte nextByte(Random rnd) { byte[] bs = {0}; rnd.nextBytes(bs); return bs[0]; }
    static char nextChar(Random rnd) { return (char)rnd.nextInt(1 << 16); }
    static double nextDouble(Random rnd) {
        long dBits = rnd.nextLong();
        final long dExponentMask = 0b0__1111_1111_111__0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000L;
        final long dFractionMask = 0b0__0000_0000_000__1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111L;
        if (rnd.nextFloat() < 0.10) {
            // ~5% chance of NaN
            dBits |= dExponentMask;
            // ~5% chance of +-Infinity
            if (rnd.nextFloat() < 0.50) {
                dBits &= ~dFractionMask;
            }
        } else if (rnd.nextFloat() < 0.10) {
            // ~5% chance of subnormal
            dBits &= ~dExponentMask;
            // ~5% chance of +-0
            if (rnd.nextFloat() < 0.50) {
                dBits &= ~dFractionMask;
            }
        }
        return Double.longBitsToDouble(dBits);
    }
    static float nextFloat(Random rnd) {
        int fBits = rnd.nextInt();
        final int fExponentMask = 0b0__1111_1111__0000_0000_0000_0000_0000_000;
        final int fFractionMask = 0b0__0000_0000__1111_1111_1111_1111_1111_111;
        if (rnd.nextFloat() < 0.10) {
            // ~5% chance of NaN
            fBits |= fExponentMask;
            // ~5% chance of +-Infinity
            if (rnd.nextFloat() < 0.50) {
                fBits &= ~fFractionMask;
            }
        } else if (rnd.nextFloat() < 0.10) {
            // ~5% chance of subnormal
            fBits &= ~fExponentMask;
            // ~5% chance of +-0
            if (rnd.nextFloat() < 0.50) {
                fBits &= ~fFractionMask;
            }
        }
        return Float.intBitsToFloat(fBits);
    }
    static int nextInt(Random rnd) { return rnd.nextInt(); }
    static long nextLong(Random rnd) { return rnd.nextLong(); }
    static short nextShort(Random rnd) { return (short)rnd.nextInt(1 << 16); }
    static boolean nextBoolean(Random rnd) { return rnd.nextBoolean(); }

    public static void main(String[] args) throws Exception {
        new File("tests/tmp").mkdirs();
        final FileWriter outExpected = new FileWriter("tests/tmp/expected.txt");
        final FileOutputStream outSerialized = new FileOutputStream("tests/tmp/serialized.ser");
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);
        final Random rnd = new Random();

        final char[] typecodes = {'B', 'C', 'D', 'F', 'I', 'J', 'S', 'Z'};

        for (int i=0; i<10_000; i++) {
            char typecode = typecodes[rnd.nextInt(typecodes.length)];

            switch (typecode) {
                case 'B':
                    byte b = GenerateTests.nextByte(rnd);
                    oos.writeByte(b);
                    outExpected.write(typecode + Byte.toString(b) + '\n');
                    break;
                case 'C':
                    char c = GenerateTests.nextChar(rnd);
                    oos.writeChar(c);
                    outExpected.write(typecode + Integer.toString(c) + '\n');
                    break;
                case 'D':
                    final double d = nextDouble(rnd);
                    oos.writeDouble(d);
                    outExpected.write(typecode + Double.toString(d) + '\n');
                    break;
                case 'F':
                    final float f = nextFloat(rnd);
                    oos.writeFloat(f);
                    outExpected.write(typecode + Double.toString((double)f) + '\n');
                    break;
                case 'I':
                    final int i_ = nextInt(rnd);
                    oos.writeInt(i_);
                    outExpected.write(typecode + Integer.toString(i_) + '\n');
                    break;
                case 'J':
                    final long l = nextLong(rnd);
                    oos.writeLong(l);
                    outExpected.write(typecode + Long.toString(l) + '\n');
                    break;
                case 'S':
                    final short s = nextShort(rnd);
                    oos.writeShort(s);
                    outExpected.write(typecode + Short.toString(s) + '\n');
                    break;
                case 'Z':
                    final boolean z = nextBoolean(rnd);
                    oos.writeBoolean(z);
                    outExpected.write(typecode + Boolean.toString(z) + '\n');
                    break;
                default:
                    throw new Exception("Unexpected typecode: " + typecode);
            }
        }

        oos.close();
        outSerialized.close();
        outExpected.close();
    }
}
