import React, { createContext, useContext } from 'react';

interface LayoutContextType {
    setTitle: (title: string) => void;
    setSubtitle: (subtitle: string) => void;
    setActions: (actions: React.ReactNode) => void;
    setSidebarMenu: (menu: { label: string; path: string; icon?: any }[] | null) => void;
    title: string;
    subtitle: string;
    actions: React.ReactNode;
    sidebarMenu: { label: string; path: string; icon?: any }[] | null;
}

export const LayoutContext = createContext<LayoutContextType>({
    setTitle: () => {},
    setSubtitle: () => {},
    setActions: () => {},
    setSidebarMenu: () => {},
    title: '',
    subtitle: '',
    actions: null,
    sidebarMenu: null
});

export const useLayout = () => useContext(LayoutContext);
