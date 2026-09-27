using System;
using System.IO;
using System.Text;

namespace Ludiars.Praeforma.Tela.Native
{
    // Tela bridge v1: length-prefixed UTF-8, little-endian, no newline conversion.
    internal sealed class TelaWire
    {
        private readonly ulong generation = BitConverter.ToUInt64(Guid.NewGuid().ToByteArray(), 0) | 1UL;
        private ulong sequence;
        internal ulong Revision;
        internal byte[] Frame(ushort kind, Action<BinaryWriter> payload = null)
        {
            using (var stream = new MemoryStream())
            using (var writer = new BinaryWriter(stream, new UTF8Encoding(false, true)))
            {
                writer.Write(0U); writer.Write(0x31574c54U); writer.Write((ushort)1); writer.Write(kind);
                writer.Write(generation); writer.Write(++sequence); writer.Write(Revision);
                Text(writer, "Praeforma"); Text(writer, "ReviewOverlay"); payload?.Invoke(writer);
                if (stream.Length > 65540) throw new InvalidDataException("Tela frame exceeds its size limit.");
                stream.Position = 0; writer.Write((uint)(stream.Length - 4)); return stream.ToArray();
            }
        }
        private static void Text(BinaryWriter writer, string value)
        {
            var bytes = new UTF8Encoding(false, true).GetBytes(value);
            writer.Write((ushort)bytes.Length); writer.Write(bytes);
        }
    }
}
