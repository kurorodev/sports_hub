import { useState } from "react";
import { avatarSource, type AvatarTone } from "../model/avatars";

export function Avatar({
  id,
  name,
  url,
  tone,
  size = 36,
}: {
  id: string;
  name: string;
  url?: string | null;
  tone?: AvatarTone;
  size?: number | string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = avatarSource(id, url, tone);
  return (
    <span
      className="user-avatar"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {failed === source ? (
        name.slice(0, 1).toLocaleUpperCase("ru")
      ) : (
        <img
          src={source}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(source)}
        />
      )}
    </span>
  );
}
