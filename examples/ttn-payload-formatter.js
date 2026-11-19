/** The Things Stack console → Payload formatters → Uplink → JavaScript.
 * Independent 1-byte DIY wire format, NOT the paper's CayenneLPP format.
 * Example LoRaWAN FRMPayload 0x0F yields binary 1111, decimal 15.
 */
function decodeUplink(input) {
  const bytes = input.bytes || [];
  if (bytes.length !== 1) {
    return { errors: ["Expected exactly 1 byte containing a four-bit RFID ID"] };
  }
  const value = bytes[0];
  if (value > 15) {
    return { errors: ["RFID ID outside range 0..15"] };
  }
  return { data: {
    tag_id_decimal: value,
    tag_id_binary: value.toString(2).padStart(4, "0"),
    tag_bit_count: 4,
    protocol: "chipless-diy-v1"
  }};
}
