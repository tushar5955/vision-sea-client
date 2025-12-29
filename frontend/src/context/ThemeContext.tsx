import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define theme types
interface ChartColors {
  background: string;
  grid: string;
  tooltip: string;
  tooltipText: string;
  line: {
    primary: string;
    secondary: string;
  };
  gradient: {
    from: string;
    to: string;
  };
}

interface ThemeColors {
  background: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
  chart: ChartColors;
}

interface Theme {
  mode: 'light' | 'dark' | 'turtle';
  colors: ThemeColors;
}

interface ThemeContextType {
  theme: Theme;
  toggleThemeMode: () => void;
  setThemeByName: (themeName: 'light' | 'dark' | 'turtle') => void;
}

interface ThemeProviderProps {
  children: ReactNode;
}

// Define default theme settings
const defaultTheme: Theme = {
  mode: 'light',
  colors: {
    background: '#ffffff',
    text: '#333333',
    primary: '#3498db',
    secondary: '#2ecc71',
    accent: '#e74c3c',
    chart: {
      background: '#f8f9fa',
      grid: '#e9ecef',
      tooltip: 'rgba(255, 255, 255, 0.9)',
      tooltipText: '#333333',
      line: {
        primary: '#3498db',
        secondary: '#2ecc71'
      },
      gradient: {
        from: 'rgba(52, 152, 219, 0.4)',
        to: 'rgba(52, 152, 219, 0.1)'
      }
    }
  }
};

// Define TurtleFlow theme
const turtleTheme: Theme = {
  mode: 'turtle',
  colors: {
    background: '#004d40',
    text: '#e0f2f1',
    primary: '#00796b',
    secondary: '#26a69a',
    accent: '#4db6ac',
    chart: {
      background: '#004d40',
      grid: '#00695c',
      tooltip: 'rgba(0, 77, 64, 0.9)',
      tooltipText: '#e0f2f1',
      line: {
        primary: '#26a69a',
        secondary: '#4db6ac'
      },
      gradient: {
        from: 'rgba(38, 166, 154, 0.6)',
        to: 'rgba(38, 166, 154, 0.1)'
      }
    }
  }
};

// Create the context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Context provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState(defaultTheme);

  const toggleThemeMode = () => {
    setTheme(prevTheme => ({
      ...prevTheme,
      mode: prevTheme.mode === 'light' ? 'dark' : 'light',
      colors: prevTheme.mode === 'light' 
        ? {
            ...prevTheme.colors,
            background: '#1a1a1a',
            text: '#f5f5f5',
            chart: {
              ...prevTheme.colors.chart,
              background: '#2d3436',
              grid: '#636e72',
              tooltip: 'rgba(45, 52, 54, 0.9)',
              tooltipText: '#f5f5f5'
            }
          }
        : defaultTheme.colors
    }));
  };

  // New function to set theme by name
  const setThemeByName = (themeName: 'light' | 'dark' | 'turtle') => {
    switch (themeName) {
      case 'turtle':
        setTheme(turtleTheme);
        break;
      case 'dark':
        setTheme({
          mode: 'dark',
          colors: {
            ...defaultTheme.colors,
            background: '#1a1a1a',
            text: '#f5f5f5',
            chart: {
              ...defaultTheme.colors.chart,
              background: '#2d3436',
              grid: '#636e72',
              tooltip: 'rgba(45, 52, 54, 0.9)',
              tooltipText: '#f5f5f5'
            }
          }
        });
        break;
      default:
        setTheme(defaultTheme);
        break;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleThemeMode, setThemeByName }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using the theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
