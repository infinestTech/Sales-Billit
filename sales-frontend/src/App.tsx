import { BrowserRouter, Routes, Route } from "react-router-dom";
import CreateBranch from "./pages/CreateBranch";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/branches" element={<CreateBranch />} />
      </Routes>
    </BrowserRouter>
  );
}