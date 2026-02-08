import React, { createContext, useContext } from 'react';

interface LayoutContextType {
    setTitle: (title: string) => void;
    setActions: (actions: React.ReactNode) => void;
    title: string;
    actions: React.ReactNode;
}

export const LayoutContext = createContext<LayoutContextType>({
    setTitle: () => {},
    setActions: () => {},
    title: '',
    actions: null
});

export const useLayout = () => useContext(LayoutContext);
