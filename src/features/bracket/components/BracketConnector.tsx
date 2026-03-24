export type BracketConnectorProps = {
  position: "top" | "bottom";
  direction: "left" | "right" | "down" | "up";
  height?: number;
  width?: number;
  type?: "normal" | "semifinal";
  offsetX?: number;
  offsetY?: number;
  color?: string;
};

export const BracketConnector = ({
  position,
  direction,
  height = 65,
  width = 50,
  type = "normal",
  offsetX = 0,
  offsetY = 0,
  color,
}: BracketConnectorProps) => {
  const halfHeight = height / 2.15;
  const halfWidth = width / 2;
  const radius = 8;
  const horizontalSegment = width * 1.5;
  const totalWidth = width * 2.5;
  const shiftX = offsetX ? `translateX(${offsetX}px)` : "";
  const shiftY = offsetY ? `translateY(${offsetY}px)` : "";
  const strokeColor = color || (type === "semifinal" ? "#facc15" : "var(--strokeColor)");

  if (type === "semifinal" && (direction === "right" || direction === "left")) {
    const isRight = direction === "right";
    const transform = [`translateY(-50%)`, shiftX, shiftY].filter(Boolean).join(" ");
    const x1 = isRight ? 0 : totalWidth;
    const x2 = isRight ? totalWidth : 0;
    return (
      <svg
        className="hidden lg:block absolute top-1/2"
        width={totalWidth}
        height={2}
        style={{
          overflow: "visible",
          transform,
          left: isRight ? "100%" : undefined,
          right: !isRight ? "100%" : undefined,
        }}
      >
        <line x1={x1} y1={1} x2={x2} y2={1} stroke={strokeColor} strokeWidth={2} />
      </svg>
    );
  }

  if (direction === "down") {
    if (position === "top") {
      const mobileTransform = [`translateX(100%)`, shiftX, shiftY].filter(Boolean).join(" ");
      return (
        <svg
          className="block lg:hidden absolute left-1/2 top-1/2"
          width={halfWidth}
          height={height}
          style={{ overflow: "visible", transform: mobileTransform }}
        >
          <path
            d={`M 0,0 Q ${halfWidth},0 ${halfWidth},${radius} L ${halfWidth},${height - radius} Q ${halfWidth},${height} 0,${height}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
          />
        </svg>
      );
    }
    return (
      <svg
        className="block lg:hidden absolute left-1/2 top-1/2"
        width={halfWidth}
        height={height}
        style={{ overflow: "visible", transform: `translateY(-100%) ${shiftX} ${shiftY}`.trim() }}
      >
        <path
          d={`M 0,${height} Q ${halfWidth},${height} ${halfWidth},${height - radius} L ${halfWidth},${radius} Q ${halfWidth},0 0,0`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
        />
      </svg>
    );
  }

  if (direction === "up") {
    if (position === "top") {
      const mobileTransform = [`translateX(100%)`, shiftX, shiftY].filter(Boolean).join(" ");
      return (
        <svg
          className="block lg:hidden absolute left-1/2 bottom-1/2"
          width={halfWidth}
          height={height}
          style={{ overflow: "visible", transform: mobileTransform }}
        >
          <path
            d={`M 0,${height} Q ${halfWidth},${height} ${halfWidth},${height - radius} L ${halfWidth},${radius} Q ${halfWidth},0 0,0`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
          />
        </svg>
      );
    }
    return (
      <svg
        className="block lg:hidden absolute left-1/2 bottom-1/2"
        width={halfWidth}
        height={height}
        style={{ overflow: "visible", transform: `translateY(100%) ${shiftX} ${shiftY}`.trim() }}
      >
        <path
          d={`M 0,0 Q ${halfWidth},0 ${halfWidth},${radius} L ${halfWidth},${height - radius} Q ${halfWidth},${height} 0,${height}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
        />
      </svg>
    );
  }

  if (direction === "right") {
    if (position === "top") {
      return (
        <svg
          className="hidden lg:block absolute left-full top-1/2"
          width={totalWidth}
          height={halfHeight}
          style={{ overflow: "visible", transform: `translateY(-100%) ${shiftX}`.trim() }}
        >
          <path
            d={`M 0,${halfHeight} 
              L ${horizontalSegment - radius},${halfHeight} 
              Q ${horizontalSegment},${halfHeight} ${horizontalSegment},${halfHeight - radius} 
              L ${horizontalSegment},${radius}
              Q ${horizontalSegment},0 ${horizontalSegment + radius},0
              L ${totalWidth},0`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
          />
        </svg>
      );
    }
    return (
      <svg
        className="hidden lg:block absolute left-full top-1/2"
        width={totalWidth}
        height={halfHeight}
        style={{ overflow: "visible", transform: `${shiftX} ${shiftY}`.trim() }}
      >
        <path
          d={`M 0,0 
              L ${horizontalSegment - radius},0 
              Q ${horizontalSegment},0 ${horizontalSegment},${radius} 
              L ${horizontalSegment},${halfHeight - radius}
              Q ${horizontalSegment},${halfHeight} ${horizontalSegment + radius},${halfHeight}
              L ${totalWidth},${halfHeight}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
        />
      </svg>
    );
  }

  if (direction === "left") {
    if (position === "bottom") {
      return (
        <svg
          className="hidden lg:block absolute right-full top-1/2"
          width={totalWidth}
          height={halfHeight}
          style={{ overflow: "visible", transform: `${shiftX} ${shiftY}`.trim() }}
        >
          <path
            d={`M ${totalWidth},0 
              L ${totalWidth - horizontalSegment + radius},0 
              Q ${totalWidth - horizontalSegment},0 ${totalWidth - horizontalSegment},${radius} 
              L ${totalWidth - horizontalSegment},${halfHeight - radius}
              Q ${totalWidth - horizontalSegment},${halfHeight} ${totalWidth - horizontalSegment - radius},${halfHeight}
              L 0,${halfHeight}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
          />
        </svg>
      );
    }
    return (
      <svg
        className="hidden lg:block absolute right-full top-1/2"
        width={totalWidth}
        height={halfHeight}
        style={{ overflow: "visible", transform: `translateY(-100%) ${shiftX}`.trim() }}
      >
        <path
          d={`M ${totalWidth},${halfHeight} 
              L ${totalWidth - horizontalSegment + radius},${halfHeight} 
              Q ${totalWidth - horizontalSegment},${halfHeight} ${totalWidth - horizontalSegment},${halfHeight - radius} 
              L ${totalWidth - horizontalSegment},${radius}
              Q ${totalWidth - horizontalSegment},0 ${totalWidth - horizontalSegment - radius},0
              L 0,0`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
        />
      </svg>
    );
  }

  return null;
};
