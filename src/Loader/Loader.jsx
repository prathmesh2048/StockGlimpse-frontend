import React from "react";

export default function Mp4Loader({
    src,
    size = 48,
    className = "",
}) {
    return (
        <video
            src={src}
            width={size}
            height={size}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={className}
            aria-hidden
        />
    );
}
