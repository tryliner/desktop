import { EmojiProvider } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";

export function AppleEmojiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmojiProvider data={emojiData}>{children}</EmojiProvider>;
}

export default AppleEmojiProvider;
