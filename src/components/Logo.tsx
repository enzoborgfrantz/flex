import ElasticMesh from "./ElasticMesh.jsx";
import "./Logo.css";

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="logo"
      onClick={onClick}
      aria-label="flex home"
    >
      <ElasticMesh
        text="Flex"
        material="balloon"
        color="#ae0404"
        inflate={0.9}
        stiffness={0.6}
        wobble={0.5}
        grabRadius={40}
        theme="dark"
      />
    </button>
  );
}
