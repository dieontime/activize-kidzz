import { render, screen } from "@testing-library/react";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders its children", () => {
    render(
      <PageShell>
        <p>Hello there</p>
      </PageShell>,
    );
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });
});
