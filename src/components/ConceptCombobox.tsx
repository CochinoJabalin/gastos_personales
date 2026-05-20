"use client";

import { useState, useEffect, useRef } from "react";

interface ConceptOption {
  concept: string;
  count: number;
}

interface ConceptComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
}

export default function ConceptCombobox({
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  wrapperClassName = "bg-surface-container-lowest rounded-lg border border-outline-variant focus-within:border-primary transition-colors",
  inputClassName = "w-full bg-transparent border-none focus:ring-0 text-body-md py-md px-md text-on-surface",
}: ConceptComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConceptOption[]>([]);
  const [search, setSearch] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search || search.length < 1) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/transactions/concepts?q=${encodeURIComponent(search)}`
        );
        if (res.ok) {
          const data = await res.json();
          setOptions(data);
          if (data.length > 0) setIsOpen(true);
          setActiveIndex(-1);
        }
      } catch {}
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(concept: string) {
    onChange(concept);
    setSearch(concept);
    setIsOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    onChange(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < options.length) {
          handleSelect(options[activeIndex].concept);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className={wrapperClassName}>
        <input
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => {
            if (options.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (onBlur) onBlur();
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          placeholder={placeholder}
          required={required}
        />
      </div>
      {isOpen && options.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-surface-container-high rounded-lg border border-outline-variant shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {options.map((opt, i) => (
              <button
                key={opt.concept}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt.concept);
                }}
                className={`w-full text-left px-3 py-2 text-body-sm hover:bg-surface-container-highest transition-colors flex items-center justify-between ${
                  i === activeIndex ? "bg-surface-container-highest" : ""
                } ${
                  opt.concept === value
                    ? "bg-primary-container text-primary"
                    : "text-on-surface"
                }`}
              >
                <span>{opt.concept}</span>
                <span className="text-label-caps text-on-surface-variant text-[10px]">
                  {opt.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
