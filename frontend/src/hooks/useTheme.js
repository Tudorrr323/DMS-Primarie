import { useEffect, useState } from "react"

export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("vite-ui-theme") || "light"
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme) => {
      localStorage.setItem("vite-ui-theme", theme)
      setTheme(theme)
    },
  }

  return value
}
