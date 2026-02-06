import { useReducer, useCallback } from 'react';
import type { QuickDrawToolId } from '../fieldConstants';

/**
 * Quick Draw Engine State
 * Manages the drawing mode, selected tool, and interaction state
 */
export interface QuickDrawState {
  // Mode
  isActive: boolean;

  // Current tool
  selectedTool: QuickDrawToolId;

  // Drawing state
  activePlayerId: string | null;
  isDrawing: boolean;
  ghostLine: Array<{ x: number; y: number }>;

  // Undo/Redo stacks
  undoStack: QuickDrawAction[];
  redoStack: QuickDrawAction[];
}

/**
 * Actions that can be undone/redone
 */
export interface QuickDrawAction {
  type: 'route' | 'block' | 'motion' | 'coverage' | 'blitz' | 'erase';
  playerId: string;
  previousState: unknown;
  newState: unknown;
}

type QuickDrawEngineAction =
  | { type: 'SET_ACTIVE'; isActive: boolean }
  | { type: 'SELECT_TOOL'; tool: QuickDrawToolId }
  | { type: 'START_DRAWING'; playerId: string }
  | { type: 'UPDATE_GHOST_LINE'; point: { x: number; y: number } }
  | { type: 'FINISH_DRAWING' }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'PUSH_UNDO'; action: QuickDrawAction }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };

const initialState: QuickDrawState = {
  isActive: false,
  selectedTool: 'select',
  activePlayerId: null,
  isDrawing: false,
  ghostLine: [],
  undoStack: [],
  redoStack: [],
};

function quickDrawReducer(state: QuickDrawState, action: QuickDrawEngineAction): QuickDrawState {
  switch (action.type) {
    case 'SET_ACTIVE':
      return {
        ...state,
        isActive: action.isActive,
        // Reset drawing state when toggling mode
        activePlayerId: null,
        isDrawing: false,
        ghostLine: [],
      };

    case 'SELECT_TOOL':
      return {
        ...state,
        selectedTool: action.tool,
        // Cancel any in-progress drawing when changing tools
        activePlayerId: null,
        isDrawing: false,
        ghostLine: [],
      };

    case 'START_DRAWING':
      return {
        ...state,
        activePlayerId: action.playerId,
        isDrawing: true,
        ghostLine: [],
      };

    case 'UPDATE_GHOST_LINE':
      return {
        ...state,
        ghostLine: [...state.ghostLine, action.point],
      };

    case 'FINISH_DRAWING':
      return {
        ...state,
        isDrawing: false,
        ghostLine: [],
        // Keep activePlayerId until route type is confirmed
      };

    case 'CANCEL_DRAWING':
      return {
        ...state,
        activePlayerId: null,
        isDrawing: false,
        ghostLine: [],
      };

    case 'PUSH_UNDO':
      return {
        ...state,
        undoStack: [...state.undoStack, action.action],
        redoStack: [], // Clear redo stack on new action
      };

    case 'UNDO':
      if (state.undoStack.length === 0) return state;
      const undoAction = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, undoAction],
      };

    case 'REDO':
      if (state.redoStack.length === 0) return state;
      const redoAction = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, redoAction],
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

/**
 * Quick Draw Engine Hook
 * Provides state management and actions for Quick Draw mode
 */
export function useQuickDrawEngine() {
  const [state, dispatch] = useReducer(quickDrawReducer, initialState);

  const setActive = useCallback((isActive: boolean) => {
    dispatch({ type: 'SET_ACTIVE', isActive });
  }, []);

  const selectTool = useCallback((tool: QuickDrawToolId) => {
    dispatch({ type: 'SELECT_TOOL', tool });
  }, []);

  const startDrawing = useCallback((playerId: string) => {
    dispatch({ type: 'START_DRAWING', playerId });
  }, []);

  const updateGhostLine = useCallback((point: { x: number; y: number }) => {
    dispatch({ type: 'UPDATE_GHOST_LINE', point });
  }, []);

  const finishDrawing = useCallback(() => {
    dispatch({ type: 'FINISH_DRAWING' });
  }, []);

  const cancelDrawing = useCallback(() => {
    dispatch({ type: 'CANCEL_DRAWING' });
  }, []);

  const pushUndo = useCallback((action: QuickDrawAction) => {
    dispatch({ type: 'PUSH_UNDO', action });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    actions: {
      setActive,
      selectTool,
      startDrawing,
      updateGhostLine,
      finishDrawing,
      cancelDrawing,
      pushUndo,
      undo,
      redo,
      reset,
    },
  };
}
