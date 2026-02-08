import React, { createContext, useContext } from 'react';

interface LayoutContextType {
    setTitle: (title: string) => void;
    setSubtitle: (subtitle: string) => void;
    setActions: (actions: React.ReactNode) => void;
    title: string;
    subtitle: string;
    actions: React.ReactNode;
}

export const LayoutContext = createContext<LayoutContextType>({
    setTitle: () => {},
    setSubtitle: () => {},
    setActions: () => {},
    title: '',
    subtitle: '',
    actions: null
});

export const useLayout = () => useContext(LayoutContext);
