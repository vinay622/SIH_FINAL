import { fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { NavRail } from "./NavRail";

vi.mock("../hooks/useAlerts", () => ({ useAlerts: () => ({ activeCount: 2 }) }));

describe("NavRail", () => {
  it("closes when a destination is selected", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<MemoryRouter><NavRail open onClose={onClose} /></MemoryRouter>);
    fireEvent.click(within(getByLabelText("Primary navigation")).getByRole("link", { name: "MISSION PLANNER" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<MemoryRouter><NavRail open onClose={onClose} /></MemoryRouter>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
