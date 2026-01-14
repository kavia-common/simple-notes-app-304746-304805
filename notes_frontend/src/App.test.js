import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * IMPORTANT TESTING NOTES
 * - We mock useNotesService so the App uses a stable fake service (no network, no localStorage).
 * - We validate both "local" and "api" modes by returning different service objects in different tests.
 * - Autosave uses timers; these tests use fake timers and explicit act() flushes for stability.
 * - We mock crypto.randomUUID for deterministic-ish toast IDs and note IDs in tests.
 */

jest.mock("./hooks/useNotesService", () => ({
  useNotesService: jest.fn(),
}));

const { useNotesService } = require("./hooks/useNotesService");

function makeNote(overrides = {}) {
  const now = overrides.updatedAt ?? 1700000000000;
  return {
    id: overrides.id ?? `n_${Math.random()}`,
    title: overrides.title ?? "Untitled note",
    body: overrides.body ?? "",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeService({ mode, initialNotes }) {
  const state = {
    notes: Array.isArray(initialNotes) ? [...initialNotes] : [],
  };

  return {
    mode,
    async listNotes() {
      return [...state.notes];
    },
    async createNote({ title, body }) {
      const created = makeNote({
        id: `${mode}_created_1`,
        title,
        body,
        createdAt: 1700000001000,
        updatedAt: 1700000001000,
      });
      // mimic persistence by inserting into backing state so subsequent listNotes sees it
      state.notes = [created, ...state.notes];
      return created;
    },
    async updateNote(id, { title, body }) {
      const idx = state.notes.findIndex((n) => n.id === id);
      if (idx === -1) throw new Error("Note not found");
      const updated = makeNote({
        ...state.notes[idx],
        title,
        body,
        updatedAt: 1700000002000,
      });
      state.notes = state.notes.map((n) => (n.id === id ? updated : n));
      return updated;
    },
    async deleteNote(id) {
      state.notes = state.notes.filter((n) => n.id !== id);
      return true;
    },
    __getState() {
      return state;
    },
  };
}

async function flushTimers(ms) {
  // Ensures pending promise microtasks and timers complete in a React-safe way.
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // allow any pending promises to flush
    await Promise.resolve();
  });
}

describe("App critical flows (mocked notes services)", () => {
  beforeEach(() => {
    jest.useFakeTimers();

    // Deterministic randomUUID for toast IDs and local service IDs if used anywhere.
    // (App uses crypto.randomUUID for toasts; localNotesService uses it for IDs.)
    Object.defineProperty(global, "crypto", {
      value: {
        randomUUID: jest.fn(() => "uuid_test"),
      },
      configurable: true,
    });

    // Never allow tests to touch the real localStorage.
    const blocked = () => {
      throw new Error("localStorage should not be accessed in these tests");
    };
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: blocked,
        setItem: blocked,
        removeItem: blocked,
        clear: blocked,
      },
      configurable: true,
    });

    jest.spyOn(window, "confirm").mockImplementation(() => true);
    useNotesService.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function getSidebar() {
    return screen.getByLabelText("Notes sidebar");
  }

  function getNotesList() {
    return within(getSidebar()).getByRole("list");
  }

  function getEditorPanel() {
    return screen.getByLabelText("Note editor panel");
  }

  function getTitleInput() {
    return within(getEditorPanel()).getByLabelText("Note title");
  }

  function getBodyInput() {
    return within(getEditorPanel()).getByLabelText("Note body");
  }

  function getSaveButton() {
    return within(getEditorPanel()).getByRole("button", { name: "Save" });
  }

  async function selectNoteByTitle(title) {
    const item = await screen.findByLabelText(`Note: ${title}`);
    await userEvent.click(item);
    return item;
  }

  test("renders header and mode label for local mode", async () => {
    const svc = makeService({ mode: "local", initialNotes: [] });
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);

    expect(screen.getByText(/Simple Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Mode:/i)).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();

    // Wait for loadNotes() to resolve
    await act(async () => {
      await Promise.resolve();
    });
  });

  test("create note flow: clicking Create note adds note and selects it (local mode)", async () => {
    const svc = makeService({ mode: "local", initialNotes: [] });
    jest.spyOn(svc, "createNote");
    jest.spyOn(svc, "listNotes");
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);

    // Empty state create button (in editor panel)
    await userEvent.click(screen.getByRole("button", { name: /Create note/i }));

    // Creation toast
    expect(await screen.findByText("Created")).toBeInTheDocument();
    expect(screen.getByText(/New note created/i)).toBeInTheDocument();

    // Note should appear in sidebar
    const createdItem = await screen.findByLabelText("Note: Untitled note");
    expect(createdItem).toBeInTheDocument();

    // Selection should cause editor to appear with title prefilled
    expect(await screen.findByLabelText("Note title")).toHaveValue("Untitled note");

    expect(svc.createNote).toHaveBeenCalledWith({ title: "Untitled note", body: "" });
    // listNotes called on initial load + after create (best-effort refresh)
    expect(svc.listNotes).toHaveBeenCalled();
  });

  test("selection behavior: switching notes updates editor draft to selected note content", async () => {
    const initialNotes = [
      makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10, createdAt: 5 }),
      makeNote({ id: "b", title: "Second", body: "Beta", updatedAt: 20, createdAt: 6 }),
    ];
    const svc = makeService({ mode: "local", initialNotes });
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);

    await act(async () => {
      await Promise.resolve();
    });

    await selectNoteByTitle("First");
    expect(getTitleInput()).toHaveValue("First");
    expect(getBodyInput()).toHaveValue("Alpha");

    await selectNoteByTitle("Second");
    expect(getTitleInput()).toHaveValue("Second");
    expect(getBodyInput()).toHaveValue("Beta");
  });

  test("search filtering: typing query filters notes list by title/body and clearing resets", async () => {
    const initialNotes = [
      makeNote({ id: "a", title: "Shopping list", body: "Eggs and milk", updatedAt: 10 }),
      makeNote({ id: "b", title: "Work", body: "Finish report", updatedAt: 20 }),
      makeNote({ id: "c", title: "Ideas", body: "milkshake recipe", updatedAt: 30 }),
    ];
    const svc = makeService({ mode: "local", initialNotes });
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    // Initially all listitems present
    expect(within(getNotesList()).getAllByRole("listitem")).toHaveLength(3);

    // Filter by body substring "milk"
    await userEvent.type(screen.getByLabelText("Search notes"), "milk");
    const filtered = within(getNotesList()).getAllByRole("listitem");
    expect(filtered).toHaveLength(2);
    expect(screen.getByLabelText("Note: Shopping list")).toBeInTheDocument();
    expect(screen.getByLabelText("Note: Ideas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Note: Work")).not.toBeInTheDocument();

    // Clear search using Clear button
    await userEvent.click(screen.getByRole("button", { name: /Clear search/i }));
    expect(within(getNotesList()).getAllByRole("listitem")).toHaveLength(3);
  });

  test("edit note + manual save: updates note via service and shows Saved toast (local mode)", async () => {
    const initialNotes = [makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 })];
    const svc = makeService({ mode: "local", initialNotes });
    jest.spyOn(svc, "updateNote");
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    await selectNoteByTitle("First");

    await userEvent.clear(getTitleInput());
    await userEvent.type(getTitleInput(), "First edited");
    await userEvent.clear(getBodyInput());
    await userEvent.type(getBodyInput(), "Alpha edited");

    await userEvent.click(getSaveButton());

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByText(/Your note is saved/i)).toBeInTheDocument();

    expect(svc.updateNote).toHaveBeenCalledWith("a", {
      title: "First edited",
      body: "Alpha edited",
    });

    // Sidebar reflects updated title (via state update)
    expect(await screen.findByLabelText("Note: First edited")).toBeInTheDocument();
  });

  test("edit note + autosave: typing triggers debounced updateNote (local mode)", async () => {
    const initialNotes = [makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 })];
    const svc = makeService({ mode: "local", initialNotes });
    jest.spyOn(svc, "updateNote");
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    await selectNoteByTitle("First");

    await userEvent.type(getBodyInput(), " + more");
    // Debounce is 700ms in App
    await flushTimers(750);

    expect(svc.updateNote).toHaveBeenCalledTimes(1);
    expect(svc.updateNote).toHaveBeenCalledWith("a", {
      title: "First",
      body: "Alpha + more",
    });
  });

  test("autosave is selection-safe: switching notes cancels stale autosave so it does not save into wrong note", async () => {
    const initialNotes = [
      makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 }),
      makeNote({ id: "b", title: "Second", body: "Beta", updatedAt: 20 }),
    ];
    const svc = makeService({ mode: "local", initialNotes });
    jest.spyOn(svc, "updateNote");
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    await selectNoteByTitle("First");
    await userEvent.type(getBodyInput(), " changed");

    // Switch notes before debounce elapses; should cancel pending save
    await selectNoteByTitle("Second");

    await flushTimers(750);

    // There should be NO updateNote call for the old note due to stale timer guard
    expect(svc.updateNote).toHaveBeenCalledTimes(0);

    // Now edit second note and let autosave happen
    await userEvent.type(getBodyInput(), " updated");
    await flushTimers(750);

    expect(svc.updateNote).toHaveBeenCalledTimes(1);
    expect(svc.updateNote).toHaveBeenCalledWith("b", {
      title: "Second",
      body: "Beta updated",
    });
  });

  test("delete note flow: confirms deletion, removes note, and preserves selection correctly", async () => {
    const initialNotes = [
      makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 }),
      makeNote({ id: "b", title: "Second", body: "Beta", updatedAt: 20 }),
    ];
    const svc = makeService({ mode: "local", initialNotes });
    jest.spyOn(svc, "deleteNote");
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    // Select "Second" (more recent updatedAt => should be first in list after sort)
    await selectNoteByTitle("Second");
    expect(getTitleInput()).toHaveValue("Second");

    // Delete selected note from its list item delete button
    const secondItem = screen.getByLabelText("Note: Second");
    await userEvent.click(within(secondItem).getByRole("button", { name: /Delete note/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(svc.deleteNote).toHaveBeenCalledWith("b");

    // Deleted toast
    expect(await screen.findByText("Deleted")).toBeInTheDocument();

    // Sidebar no longer shows Second
    expect(screen.queryByLabelText("Note: Second")).not.toBeInTheDocument();

    // Selection should move to next remaining note if any (First)
    expect(await screen.findByLabelText("Note title")).toHaveValue("First");
  });

  test("error handling: create failure shows toast and does not destructively clear UI state", async () => {
    const initialNotes = [makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 })];

    const svc = makeService({ mode: "local", initialNotes });
    jest.spyOn(svc, "createNote").mockRejectedValueOnce(new Error("Create boom"));
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    // Select existing note first
    await selectNoteByTitle("First");
    expect(getTitleInput()).toHaveValue("First");

    // Attempt to create using sidebar + New
    await userEvent.click(screen.getByRole("button", { name: /\+ New/i }));

    expect(await screen.findByText("Create failed")).toBeInTheDocument();
    expect(screen.getByText(/Create boom/i)).toBeInTheDocument();

    // Ensure existing selection and editor state remains (non-destructive)
    expect(getTitleInput()).toHaveValue("First");
    expect(getBodyInput()).toHaveValue("Alpha");
    expect(screen.getByLabelText("Note: First")).toBeInTheDocument();
  });

  test("error handling: save failure shows toast and preserves draft (no destructive state)", async () => {
    const initialNotes = [makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 })];

    const svc = makeService({ mode: "local", initialNotes });
    jest.spyOn(svc, "updateNote").mockRejectedValueOnce(new Error("Save boom"));
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    await selectNoteByTitle("First");

    await userEvent.clear(getBodyInput());
    await userEvent.type(getBodyInput(), "Draft body that should remain");

    await userEvent.click(getSaveButton());

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(screen.getByText(/Save boom/i)).toBeInTheDocument();

    // Draft should remain in textarea after failure (non-destructive)
    expect(getBodyInput()).toHaveValue("Draft body that should remain");
    // Selected note still the same
    expect(getTitleInput()).toHaveValue("First");
  });

  test("API mode: uses api service and shows Mode: API; create/edit/delete still work against mocked api service", async () => {
    const initialNotes = [makeNote({ id: "a", title: "First", body: "Alpha", updatedAt: 10 })];
    const svc = makeService({ mode: "api", initialNotes });
    jest.spyOn(svc, "createNote");
    jest.spyOn(svc, "updateNote");
    jest.spyOn(svc, "deleteNote");
    useNotesService.mockReturnValue(svc);

    render(<require("./App").default />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("API")).toBeInTheDocument();

    // Create via sidebar + New
    await userEvent.click(screen.getByRole("button", { name: /\+ New/i }));
    expect(await screen.findByText("Created")).toBeInTheDocument();
    expect(svc.createNote).toHaveBeenCalled();

    // Select existing note and manual save
    await selectNoteByTitle("First");
    await userEvent.type(getTitleInput(), " (api)");
    await userEvent.click(getSaveButton());
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(svc.updateNote).toHaveBeenCalled();

    // Delete "First"
    const firstItem = screen.getByLabelText("Note: First");
    await userEvent.click(within(firstItem).getByRole("button", { name: /Delete note/i }));
    expect(await screen.findByText("Deleted")).toBeInTheDocument();
    expect(svc.deleteNote).toHaveBeenCalledWith("a");
  });
});
