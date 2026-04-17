import { Handle, Position } from "reactflow";
import type { StateNodeData } from "../visualization/dfaToReactFlow";

export const DFA_NODE_SIZE = 60;

export function DfaNode(props: { data: StateNodeData; selected?: boolean; isConnectable?: boolean }) {
  const { data, selected, isConnectable } = props;

  const isAccept = data.isAccept;
  const isStart = data.isStart;
  const acceptColor = "var(--dfa-accept)";

  const containerStyle: React.CSSProperties = {
    width: DFA_NODE_SIZE,
    height: DFA_NODE_SIZE,
    borderRadius: "50%",
    border: `2px solid ${isAccept ? acceptColor : "var(--dfa-node-stroke)"}`,
    background: "var(--dfa-node-bg)",
    color: "var(--dfa-node-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
    boxShadow: selected ? "0 0 0 4px rgba(61,169,252,0.4)" : "none",
    boxSizing: "border-box",
    position: "relative",
  };
  const handleStyle: React.CSSProperties = { 
    top: "50%", 
    left: "50%", 
    transform: "translate(-50%, -50%)", 
    width: "100%", 
    height: "100%", 
    opacity: 0,
    borderRadius: "50%",
    zIndex: 10,
    // Only show crosshair and allow pointer events on handle when in connection mode
    cursor: isConnectable ? "crosshair" : "default",
    pointerEvents: isConnectable ? "all" : "none",
  };

  return (
    <div style={containerStyle} className="custom-dfa-node">
      {isStart && (
        <div
          style={{
            position: "absolute",
            left: -24,
            top: "50%",
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderTop: "16px solid transparent",
            borderBottom: "16px solid transparent",
            borderLeft: "24px solid var(--color-primary)",
            pointerEvents: "none",
          }}
        />
      )}
      {isAccept && (
        <div
          style={{
            position: "absolute",
            inset: 5,
            borderRadius: "50%",
            border: `2px solid ${acceptColor}`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      <Handle
        type="source"
        position={Position.Top}
        id="center"
        style={handleStyle}
        isConnectable={isConnectable}
        isConnectableStart={isConnectable}
        isConnectableEnd={isConnectable}
      />

      <div
        style={{
          zIndex: 11,
          pointerEvents: "none",
          maxWidth: "84%",
          textAlign: "center",
          lineHeight: 1.1,
          fontSize: data.label.length > 8 ? 11 : 12,
          wordBreak: "break-word",
        }}
      >
        {data.label}
      </div>
    </div>
  );
}
