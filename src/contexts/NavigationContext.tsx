import { createContext, useContext, useState, ReactNode } from 'react';

// Navigation context types
interface NavigationContextType {
  currentPage: string;
  pageParams: Record<string, any>;
  navigate: (page: string, id?: string) => void;
  navigateTo: (page: string, params?: Record<string, any>) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: ReactNode;
  currentPage: string;
  pageParams: Record<string, any>;
  navigateTo: (page: string, params?: Record<string, any>) => void;
}

export const NavigationProvider = ({ 
  children, 
  currentPage, 
  pageParams, 
  navigateTo 
}: NavigationProviderProps) => {
  // Helper function for simplified navigation with id
  const navigate = (page: string, id?: string) => {
    if (id) {
      navigateTo(page, { id });
    } else {
      navigateTo(page);
    }
  };

  return (
    <NavigationContext.Provider value={{ currentPage, pageParams, navigate, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
};
