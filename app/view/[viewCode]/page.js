// app/view/[viewCode]/page.js
import ScreenViewClient from "@/components/ScreenViewClient";

export default function ViewScreenPage({ params }) {
  return <ScreenViewClient viewCode={params.viewCode} />;
}
