import { useParams } from "react-router";
import { useNavigate } from "react-router";
import ComposeEmail from "@/components/ComposeEmail";

export default function Compose() {
  const { replyTo } = useParams();
  const navigate = useNavigate();

  return (
    <ComposeEmail
      open={true}
      onClose={() => navigate("/")}
      replyToId={replyTo}
    />
  );
}
