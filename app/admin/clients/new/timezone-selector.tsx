'use client';

import { useState, useRef, useEffect } from 'react';

// Common IANA timezones (most used ones for better UX)
const TIMEZONES = [
  // US & Canada
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  
  // Latin America
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Bogota',
  
  // Europe
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Athens',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Bucharest',
  'Europe/Moscow',
  'Europe/Istanbul',
  
  // Asia
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Manila',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Tehran',
  'Asia/Jerusalem',
  
  // Australia & Pacific
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Honolulu',
  
  // Africa
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Casablanca',
].sort();

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  required?: boolean;
}

export function TimezoneSelector({ value, onChange, required }: TimezoneSelectorProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTimezones = TIMEZONES.filter(tz =>
    tz.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setShowDropdown(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredTimezones.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredTimezones[highlightedIndex]) {
          selectTimezone(filteredTimezones[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  }

  function selectTimezone(tz: string) {
    onChange(tz);
    setSearch('');
    setShowDropdown(false);
    inputRef.current?.blur();
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown) {
      const highlightedEl = dropdownRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, showDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      {value && !showDropdown ? (
        // Display selected timezone
        <div className="flex items-center justify-between w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
          <span className="text-white font-mono">{value}</span>
          <button
            type="button"
            onClick={() => {
              setShowDropdown(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Change
          </button>
        </div>
      ) : (
        // Search input
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
          placeholder="Type to search timezones..."
          required={required}
        />
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filteredTimezones.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">
              No timezones found matching "{search}"
            </div>
          ) : (
            filteredTimezones.map((tz, index) => (
              <button
                key={tz}
                type="button"
                data-index={index}
                onClick={() => selectTimezone(tz)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-800 transition-colors ${
                  index === highlightedIndex ? 'bg-zinc-800' : ''
                } ${value === tz ? 'text-white font-semibold' : 'text-zinc-300'}`}
              >
                {tz}
              </button>
            ))
          )}
        </div>
      )}

      {/* Hidden input for form validation */}
      <input
        type="hidden"
        value={value}
        required={required}
      />
    </div>
  );
}




