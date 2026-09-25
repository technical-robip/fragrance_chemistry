import { useState } from 'react';
import Select, {
  GroupBase,
  MultiValue,
  Props as SelectProps,
  StylesConfig,
  components,
  MultiValueProps,
} from 'react-select';
import styles from './FcSelect.module.css';

export type FcSelectOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
  name?: string;
};

export type FcSelectPlatform = 'web' | 'native';

type CommonProps = {
  options: FcSelectOption[];
  placeholder?: string;
  isDisabled?: boolean;
  isSearchable?: boolean;
  isClearable?: boolean;
  className?: string;
  inputId?: string;
  'aria-label'?: string;
  noOptionsMessage?: () => string;
  components?: SelectProps<FcSelectOption, false, GroupBase<FcSelectOption>>['components'];
  controlShouldRenderValue?: boolean;
  closeMenuOnSelect?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  /** Reserved for future React Native / Capacitor adapters. */
  platform?: FcSelectPlatform;
};

type SingleProps = CommonProps & {
  isMulti?: false;
  value: string | null;
  onChange: (value: string | null) => void;
};

type MultiProps = CommonProps & {
  isMulti: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type FcSelectProps = SingleProps | MultiProps;

const selectStyles: StylesConfig<FcSelectOption, boolean, GroupBase<FcSelectOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 'var(--fc-touch-min)',
    borderRadius: 'var(--fc-radius-sm)',
    borderColor: state.isFocused ? 'var(--fc-accent)' : 'var(--fc-input-border)',
    background: 'var(--fc-input-bg)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--fc-accent)' : 'none',
    '&:hover': { borderColor: 'var(--fc-accent)' },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 8px',
    gap: 4,
  }),
  multiValue: (base) => ({
    ...base,
    background: 'color-mix(in srgb, var(--fc-accent) 16%, transparent)',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--fc-accent) 35%, transparent)',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'var(--fc-text)',
    fontWeight: 600,
    fontSize: '0.78rem',
    padding: '2px 6px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'var(--fc-text-muted)',
    borderRadius: 999,
    ':hover': {
      background: 'color-mix(in srgb, var(--fc-danger) 20%, transparent)',
      color: 'var(--fc-danger)',
    },
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--fc-bg-elevated)',
    border: 'var(--fc-border)',
    borderRadius: 'var(--fc-radius-md)',
    overflow: 'hidden',
    zIndex: 120,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 120 }),
  menuList: (base) => ({
    ...base,
    maxHeight: 'min(50vh, 320px)',
    padding: 4,
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 'var(--fc-radius-sm)',
    padding: '4px 8px',
    background: state.isSelected
      ? 'color-mix(in srgb, var(--fc-accent) 22%, transparent)'
      : state.isFocused
        ? 'var(--fc-chip-bg)'
        : 'transparent',
    color: 'var(--fc-text)',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: 'var(--fc-text)' }),
  input: (base) => ({ ...base, color: 'var(--fc-text)' }),
  placeholder: (base) => ({ ...base, color: 'var(--fc-text-muted)' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--fc-text-muted)' }),
};

function BadgeMultiValue(props: MultiValueProps<FcSelectOption, true>) {
  return (
    <components.MultiValue {...props} className={styles.badge}>
      {props.children}
    </components.MultiValue>
  );
}

/**
 * Platform-ready select control.
 * `platform: 'web'` uses react-select; `'native'` is reserved for a future native picker.
 */
export function FcSelect(props: FcSelectProps) {
  const {
    options,
    placeholder,
    isDisabled,
    isSearchable = false,
    isClearable = false,
    className,
    inputId,
    platform = 'web',
    noOptionsMessage,
    components: extraComponents,
    controlShouldRenderValue,
    closeMenuOnSelect,
    onMenuOpen,
    onMenuClose,
  } = props;
  const [menuOpen, setMenuOpen] = useState(false);

  if (platform === 'native') {
    // Future: Capacitor / React Native picker. Fall through to web for now.
  }

  const hideValueWhileSearching = isSearchable && menuOpen;
  const common: Partial<SelectProps<FcSelectOption, boolean>> = {
    inputId,
    options,
    placeholder,
    isDisabled,
    isSearchable,
    isClearable,
    classNamePrefix: 'fc-select',
    className: `${styles.root} ${className ?? ''}`.trim(),
    styles: selectStyles,
    menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
    menuPosition: 'fixed',
    menuShouldScrollIntoView: false,
    closeMenuOnSelect,
    controlShouldRenderValue: controlShouldRenderValue ?? !hideValueWhileSearching,
    noOptionsMessage: noOptionsMessage ? () => noOptionsMessage() : undefined,
    onMenuOpen: () => {
      setMenuOpen(true);
      onMenuOpen?.();
    },
    onMenuClose: () => {
      setMenuOpen(false);
      onMenuClose?.();
    },
  };

  if (props.isMulti) {
    const selected = options.filter((o) => props.value.includes(o.value));
    return (
      <Select<FcSelectOption, true>
        {...(common as SelectProps<FcSelectOption, true>)}
        isMulti
        value={selected}
        onChange={(next: MultiValue<FcSelectOption>) => {
          props.onChange(next.map((o) => o.value));
        }}
        components={
          {
            MultiValue: BadgeMultiValue,
            ...extraComponents,
          } as SelectProps<FcSelectOption, true>['components']
        }
        aria-label={props['aria-label']}
      />
    );
  }

  const selected = options.find((o) => o.value === props.value) ?? null;
  return (
    <Select<FcSelectOption, false>
      {...(common as SelectProps<FcSelectOption, false>)}
      isMulti={false}
      value={selected}
      onChange={(next) => props.onChange(next?.value ?? null)}
      components={extraComponents}
      aria-label={props['aria-label']}
    />
  );
}
