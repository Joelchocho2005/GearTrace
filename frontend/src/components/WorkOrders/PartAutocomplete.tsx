import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Loader2, PackagePlus, Search, X } from 'lucide-react';
import { getApiErrorMessage } from '../../api/errors';
import { inventoryApi } from '../../api/resources';
import type { InventoryPart } from '../../api/types';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

interface PartAutocompleteProps {
  disabled?: boolean;
  /** Debe lanzar si falla, para conservar la selección y mostrar el error. */
  onAdd: (part: InventoryPart, quantity: number) => Promise<void>;
}

/** Buscador de piezas del inventario + cantidad para agregarlas a una OT. */
export default function PartAutocomplete({ disabled = false, onAdd }: PartAutocompleteProps) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InventoryPart[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<InventoryPart | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [isAdding, setIsAdding] = useState(false);
  const latestRequest = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (selected || term.length < MIN_QUERY_LENGTH) {
      latestRequest.current += 1;
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = ++latestRequest.current;
    setIsSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(async () => {
      try {
        const parts = await inventoryApi.searchParts(term);
        if (requestId !== latestRequest.current) return; // respuesta obsoleta
        setResults(parts);
        setActiveIndex(parts.findIndex((part) => part.quantity > 0));
        setIsOpen(true);
      } catch (error) {
        if (requestId === latestRequest.current) {
          setSearchError(getApiErrorMessage(error, 'No se pudo buscar en el inventario.'));
        }
      } finally {
        if (requestId === latestRequest.current) setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, selected]);

  const choose = (part: InventoryPart) => {
    if (part.quantity <= 0) return;
    setSelected(part);
    setQuery(`${part.name} (${part.code})`);
    setQuantity('1');
    setIsOpen(false);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setQuantity('1');
  };

  const moveActive = (step: 1 | -1) => {
    if (results.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < results.length; i += 1) {
      next = (next + step + results.length) % results.length;
      if (results[next].quantity > 0) break;
    }
    setActiveIndex(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.stopPropagation(); // cierra solo la lista, no el panel que la contiene
      setIsOpen(false);
    }
  };

  const parsedQuantity = Number(quantity);
  const quantityError =
    selected && (!Number.isInteger(parsedQuantity) || parsedQuantity < 1)
      ? 'Ingresa una cantidad entera mayor a 0.'
      : selected && parsedQuantity > selected.quantity
        ? `Solo hay ${selected.quantity} en stock.`
        : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || quantityError) return;
    setIsAdding(true);
    try {
      await onAdd(selected, parsedQuantity);
      clearSelection();
    } catch {
      // El padre ya notificó el error; se conserva la selección para corregir.
    } finally {
      setIsAdding(false);
    }
  };

  const showList = isOpen && !selected && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-label="Buscar repuesto por nombre o código"
          disabled={disabled || isAdding}
          value={query}
          onChange={(event) => {
            if (selected) setSelected(null);
            setQuery(event.target.value);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar repuesto por nombre o código…"
          className="w-full rounded-xl py-2.5 pl-9 pr-9 text-sm text-white disabled:opacity-50 glass-input"
        />
        {isSearching ? (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-400" />
        ) : (
          (query || selected) && (
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-white"
            >
              <X size={15} />
            </button>
          )
        )}

        {showList && (
          <ul
            id={listboxId}
            role="listbox"
            className="glass absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl p-1 shadow-2xl"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-400">Sin coincidencias en el inventario.</li>
            ) : (
              results.map((part, index) => {
                const outOfStock = part.quantity <= 0;
                return (
                  <li
                    key={part.id}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    aria-disabled={outOfStock}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => !outOfStock && setActiveIndex(index)}
                    onClick={() => choose(part)}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                      outOfStock
                        ? 'cursor-not-allowed opacity-50'
                        : index === activeIndex
                          ? 'cursor-pointer bg-brand-500/15 text-white'
                          : 'cursor-pointer text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{part.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {part.code}
                        {part.box && ` · ${part.box.name}`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        outOfStock ? 'text-red-400' : part.quantity <= part.minStock ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {outOfStock ? 'Sin stock' : `${part.quantity} disp.`}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {searchError && <p className="text-xs text-red-400">{searchError}</p>}

      {selected && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Cantidad
            <input
              type="number"
              min={1}
              max={selected.quantity}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-24 rounded-lg px-3 py-2 text-sm text-white glass-input"
            />
          </label>
          <button
            type="submit"
            disabled={isAdding || quantityError !== null}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 btn-primary"
          >
            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
            Agregar a la OT
          </button>
          <p className={`w-full text-xs ${quantityError ? 'text-amber-400' : 'text-slate-500'}`}>
            {quantityError ?? `Se descontará del inventario al agregar (stock actual: ${selected.quantity}).`}
          </p>
        </div>
      )}
    </form>
  );
}
