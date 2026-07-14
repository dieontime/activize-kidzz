import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  it("renders the app title on boot", () => {
    render(<App />);
    expect(screen.getByText(/activize kidzz/i)).toBeInTheDocument();
  });
});
