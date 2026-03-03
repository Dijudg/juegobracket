import type { ReactNode } from "react";
import modalBackImage from "../../../assets/fondo.jpg";
import shareBackLogo from "../../../assets/7flapollalog.png";

export const ModalFlipFrame = ({
  className,
  children,
  disableFlip = false,
}: {
  className: string;
  children: ReactNode;
  disableFlip?: boolean;
}) => {
  const frameClass = `mx-auto ${className}`;
  const cardClass = `modal-flip-card${disableFlip ? " modal-flip-card--static" : ""}`;
  return (
    <div className="modal-flip" style={{ ["--modal-back" as any]: `url(${modalBackImage})` }}>
      <div className={cardClass}>
        <div className={`modal-flip-back ${frameClass}`} aria-hidden="true">
          <img className="modal-flip-back__logo" src={shareBackLogo} alt="7flapollalog" />
        </div>
        <div className={`modal-flip-front ${frameClass}`}>{children}</div>
      </div>
    </div>
  );
};
