import "./globals.css";
import { LayerStackProvider } from "@/components/LayerStackProvider";

export const metadata = {
  title: "Sysbyte WebApp",
  description: "Customer + Calander Containers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="text-white">
        <LayerStackProvider>{children}</LayerStackProvider>
      </body>
    </html>
  );
}
