import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Save, AlertCircle, CheckCircle, Activity, Zap, Repeat, Clock, BookOpen, Shield } from 'lucide-react';
import useDataStore from '../store/useDataStore';
import projectService from '../services/projectService';
import PrdTheory from './Theory/PrdTheory';
import { GeneratorTheoryMain, GeneratorReactanceTheory, GeneratorRatingTheory, GeneratorLoadClassification, GeneratorSetTable } from './Theory/GeneratorTheory';
import UpsTheory from './Theory/UpsTheory';
import CbTheory from './Theory/CbTheory';
import XlpeTheory from './Theory/XlpeTheory';
import CtTheory from './Theory/CtTheory';
import RxTheory from './Theory/RxTheory';
import OdTheory from './Theory/OdTheory';
import PlTheory from './Theory/PlTheory';
import MasterNavModal from './common/MasterNavModal';

const DataViewer = ({ csvFile, title, subtitle = "TECHNICAL_DATA" }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchRef = useRef(null);
    const [scrollY, setScrollY] = useState(0);
    const activeProjectId = useDataStore(state => state.activeProjectId);
    const [isLoadedFromRemote, setIsLoadedFromRemote] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [fuseSettings, setFuseSettings] = useState({
        '100 ~ 150kVA': 2.0,
        '200 ~ 300kVA': 1.5,
        '350 ~ 450kVA': 1.5,
        '500 ~ 700kVA': 1.5,
        '750 ~ 1000kVA': 1.25,
        '1050 ~ 1600kVA': 1.5
    });

    // Load initial settings (DB -> LocalStorage -> Default)
    useEffect(() => {
        const loadSettings = async () => {
            const defaultKey = 'kelc_fuse_settings_v2';
            const projectId = activeProjectId || projectService.getActiveProjectId();
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;

            let loadedData = null;

            // 1. Try MariaDB first if project exists
            if (projectId) {
                try {
                    const remote = await projectService.getRemoteData(projectKey, projectId)
                        || await projectService.getRemoteData(defaultKey, projectId);
                    if (remote) {
                        loadedData = remote;
                        // Migration: If loaded from global key, save to project-specific
                        if (!await projectService.getRemoteData(projectKey, projectId)) {
                            await projectService.setRemoteData(projectId, projectKey, remote);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load settings from DB:', e);
                }
            }

            // 2. Fallback to LocalStorage
            if (!loadedData) {
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) {
                    try {
                        loadedData = JSON.parse(saved);
                    } catch (e) {
                        console.error('Failed to parse localStorage data:', e);
                    }
                }
            }

            if (loadedData) {
                setFuseSettings(loadedData);
            }
            setIsLoadedFromRemote(true);
        };

        if (csvFile === 'PRD') {
            loadSettings();
        }
    }, [csvFile, activeProjectId]);

    // Save to local storage for quick sync
    useEffect(() => {
        if (isLoadedFromRemote && csvFile === 'PRD') {
            const defaultKey = 'kelc_fuse_settings_v2';
            const projectId = activeProjectId || projectService.getActiveProjectId();
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            localStorage.setItem(projectKey, JSON.stringify(fuseSettings));

            // Dispatch event for other tabs
            window.dispatchEvent(new Event('kelc_fuse_settings_updated'));
        }
    }, [fuseSettings, activeProjectId, isLoadedFromRemote, csvFile]);

    const handleSave = async () => {
        if (csvFile !== 'PRD') return;

        const defaultKey = 'kelc_fuse_settings_v2';
        const projectId = activeProjectId || projectService.getActiveProjectId();

        if (!projectId) {
            setToast({ show: true, message: '활성화된 프로젝트가 없습니다.', type: 'error' });
            return;
        }

        const projectKey = `${defaultKey}_${projectId}`;

        try {
            await projectService.setRemoteData(projectId, projectKey, fuseSettings);
            setToast({ show: true, message: '설정이 성공적으로 저장되었습니다.', type: 'success' });

            // Sync current project's info
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        } catch (e) {
            console.error('Save failed:', e);
            setToast({ show: true, message: '저장에 실패했습니다.', type: 'error' });
        }
    };

    // Close toast automatically
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close search on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`/db/${csvFile}.csv`);
                const reader = response.body.getReader();
                const result = await reader.read();
                const decoder = new TextDecoder('utf-8');
                const csv = decoder.decode(result.value);

                Papa.parse(csv, {
                    complete: (results) => {
                        setData(results.data);
                        setLoading(false);
                    },
                    error: (err) => {
                        setError(err.message);
                        setLoading(false);
                    }
                });
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchData();
    }, [csvFile]);

    const CornerBorders = () => (
        <>
            <div className="corner-tl border-gray-800" />
            <div className="corner-tr border-gray-800" />
            <div className="corner-bl border-gray-800" />
            <div className="corner-br border-gray-800" />
        </>
    );

    const sections = React.useMemo(() => {
        if (!data || data.length === 0) return [];

        const result = [];
        let currentSection = null;
        let lastHeaders = [];
        let currentGroupTitle = '';
        let i = 0;

        const isTitleRow = (row) => {
            if (!row || row.length === 0) return false;
            const firstCell = row[0]?.toString().trim() || '';
            if (firstCell.startsWith('*')) return true;
            const nonBlankCells = row.filter(c => c && c.toString().trim() !== '');
            if (nonBlankCells.length !== 1) return false;

            const val = nonBlankCells[0].toString().trim();
            return isNaN(Number(val));
        };

        const isHeaderRow = (row) => {
            if (!row || row.length === 0) return false;
            const keywords = [
                '㎟', 'mm²', 'kg/km', '호칭', 'Φ', 'AF', 'TYPE', 'CB', '공칭', '용량', '외경', '내경',
                '단면적', '공칭단면적', '중량', '비고', 'W', 'H', 'D', 'kA', '1C', '2C', '3C', '4C',
                '1P', '2W', '3W', '4W', 'TRI', 'HORIZ', 'R', 'X', '부하', '효율', 'CABLE', 'PE',
                'HV', 'LV', '변압기', '정격', 'PT', 'CT', 'LBS', 'PF', 'MOF', 'ACB', 'IS', '구분',
                '정격전류', '정격차단전류', '정격사용전압', '비상출력', '상용출력', '연료탱크', '무게', 'PAD', 'Model', 'kW', 'kVA',
                '발전기', '모델', '엔진', '배기', '급기'
            ];
            return row.some(cell => {
                const val = cell?.toString().trim();
                if (!val) return false;
                return keywords.some(k => {
                    if (k.length <= 2) return val === k || val.startsWith(k + ' ');
                    if (k.length <= 4) return val === k;
                    return val === k || val.includes(k);
                });
            });
        };

        while (i < data.length) {
            const row = data[i];
            const firstCell = row[0]?.toString().trim() || '';

            if (isTitleRow(row)) {
                if (currentSection) result.push(currentSection);

                const val = firstCell.replace(/^\*\s*/, '');
                let subTitle = '';
                let cardTitle = '';

                if (firstCell.startsWith('*')) {
                    currentGroupTitle = val;
                    i++;
                    if (i < data.length && isTitleRow(data[i])) {
                        subTitle = csvFile === 'GEN' ? '' : data[i][0]?.toString().trim();
                        cardTitle = data[i][0]?.toString().trim();
                        i++;
                    } else {
                        subTitle = '';
                        cardTitle = val;
                    }
                }
                else if (/^\d+\./.test(val)) {
                    currentGroupTitle = val;
                    i++;
                    if (i < data.length && isTitleRow(data[i])) {
                        subTitle = csvFile === 'GEN' ? '' : data[i][0]?.toString().trim();
                        cardTitle = data[i][0]?.toString().trim();
                        i++;
                    } else {
                        subTitle = '';
                        cardTitle = val;
                    }
                }
                else {
                    subTitle = csvFile === 'GEN' ? '' : val;
                    cardTitle = val;
                    i++;
                    if (i < data.length && isTitleRow(data[i])) {
                        cardTitle = data[i][0]?.toString().trim();
                        i++;
                    }
                }

                currentSection = {
                    groupTitle: currentGroupTitle,
                    subTitle: subTitle,
                    cardTitle: cardTitle,
                    headers: [],
                    rows: []
                };

                while (i < data.length && isHeaderRow(data[i])) {
                    currentSection.headers.push(data[i]);
                    i++;
                }

                if (currentSection.headers.length > 0) {
                    lastHeaders = currentSection.headers;
                } else if (lastHeaders.length > 0) {
                    currentSection.headers = [...lastHeaders];
                }
            } else if (isHeaderRow(row)) {
                if (!currentSection) {
                    currentSection = { groupTitle: '', subTitle: '', cardTitle: title, headers: [], rows: [] };
                }
                currentSection.headers.push(row);
                i++;
            } else {
                const isBlank = row.every(cell => !cell || cell.toString().trim() === '');
                if (!isBlank && currentSection) {
                    currentSection.rows.push(row);
                }
                i++;
            }
        }
        if (currentSection) result.push(currentSection);

        // Inject Custom Fuse Section and ACB Type for PRD
        if (csvFile === 'PRD') {
            const mainTable = result.find(s => s.cardTitle === 'POWER SYSTEM STANDARDS BY TRANSFORMER');
            if (mainTable) {
                // Rename headers: 25.8kV to 24kV
                mainTable.headers = mainTable.headers.map(hRow =>
                    hRow.map(cell => {
                        if (!cell) return cell;
                        const val = cell.toString().trim();
                        return val === '25.8kV' ? '24kV' : cell;
                    })
                );

                const ratings = [
                    { a: 5, ka: 40 }, { a: 10, ka: 40 }, { a: 16, ka: 40 }, { a: 20, ka: 40 },
                    { a: 25, ka: 40 }, { a: 30, ka: 40 }, { a: 40, ka: 40 }, { a: 50, ka: 40 },
                    { a: 63, ka: 40 }, { a: 75, ka: 25 }, { a: 100, ka: 25 }, { a: 125, ka: 25 },
                    { a: 160, ka: 25 }, { a: 200, ka: 25 }
                ];

                mainTable.rows = mainTable.rows.map(row => {
                    const newRow = [...row];
                    const kva = parseInt(newRow[0]);
                    const i_n1 = parseFloat(newRow[1]);

                    if (!isNaN(kva) && !isNaN(i_n1)) {
                        let multiplier = 1.4;
                        if (kva <= 150) multiplier = fuseSettings['100 ~ 150kVA'];
                        else if (kva <= 300) multiplier = fuseSettings['200 ~ 300kVA'];
                        else if (kva <= 450) multiplier = fuseSettings['350 ~ 450kVA'];
                        else if (kva <= 700) multiplier = fuseSettings['500 ~ 700kVA'];
                        else if (kva <= 1000) multiplier = fuseSettings['750 ~ 1000kVA'];
                        else if (kva <= 1600) multiplier = fuseSettings['1050 ~ 1600kVA'];

                        const target = i_n1 * multiplier;
                        const match = ratings.find(r => r.a >= target) || ratings[ratings.length - 1];
                        const formatted = `${match.a}A/${match.ka}kA`;
                        newRow[2] = formatted;
                        newRow[6] = formatted;
                    }
                    return newRow;
                });
            }

            const targetIndex = result.findIndex(s => s.cardTitle === 'POWER SYSTEM STANDARDS BY TRANSFORMER');
            if (targetIndex !== -1) {
                result.splice(targetIndex + 1, 0, {
                    groupTitle: 'POWER SYSTEM STANDARDS BY TRANSFORMER',
                    subTitle: '한류형 퓨즈(Current-Limiting Fuse)',
                    cardTitle: '한류형 퓨즈(Current-Limiting Fuse)',
                    type: 'custom-fuse',
                    headers: [],
                    rows: []
                });
            }

            // Mark ACB section with specific type
            const acbSection = result.find(s => s.cardTitle === '기중차단기 (Air Circuit Breaker)');
            if (acbSection) {
                acbSection.type = 'custom-acb';
            }

            // Mark VCB section with specific type
            const vcbSection = result.find(s => s.cardTitle === '진공차단기 (Vacuum Circuit Breaker)');
            if (vcbSection) {
                vcbSection.type = 'custom-vcb';
            }
        }

        result.forEach(section => {
            if (section.type === 'custom-fuse') return;
            let maxCol = 0;
            section.headers.forEach(row => {
                row.forEach((cell, idx) => {
                    if (cell && cell.toString().trim() !== '') {
                        if (idx > maxCol) maxCol = idx;
                    }
                });
            });
            section.rows.forEach(row => {
                row.forEach((cell, idx) => {
                    if (cell && cell.toString().trim() !== '') {
                        if (idx > maxCol) maxCol = idx;
                    }
                });
            });

            section.headers = section.headers.map(row => row.slice(0, maxCol + 1));
            section.rows = section.rows.map(row => row.slice(0, maxCol + 1));
        });

        if (result.length === 0 && data.length > 0) {
            result.push({
                groupTitle: '',
                subTitle: '',
                cardTitle: title,
                headers: [data[0]],
                rows: data.slice(1)
            });
        }

        if (csvFile === 'CT') {
            result.forEach(s => {
                s.groupTitle = 'Current Transformer Ratings';
            });
        }

        if (csvFile === 'GEN') {
            return result.filter(s => !s.groupTitle?.includes('Diesel Generator Air Intake/Exhaust') && !s.cardTitle?.includes('Diesel Generator Air Intake/Exhaust'));
        }

        return result;
    }, [data, title, csvFile, fuseSettings]);

    // Filter sections and rows based on searchTerm
    const filteredSections = React.useMemo(() => {
        return sections.map(section => {
            if (!searchTerm.trim()) return section;

            const term = searchTerm.toLowerCase();
            const matchesTitle =
                (section.groupTitle?.toLowerCase().includes(term)) ||
                (section.subTitle?.toLowerCase().includes(term)) ||
                (section.cardTitle?.toLowerCase().includes(term));

            const matchingRows = section.rows.filter(row =>
                row.some(cell => cell?.toString().toLowerCase().includes(term))
            );

            const matchesHeader = section.headers.some(hRow =>
                hRow.some(cell => cell?.toString().toLowerCase().includes(term))
            );

            if (matchesTitle || matchesHeader || matchingRows.length > 0) {
                return {
                    ...section,
                    rows: matchingRows.length > 0 ? matchingRows : (matchesTitle || matchesHeader ? section.rows : [])
                };
            }
            return null;
        }).filter(Boolean);
    }, [sections, searchTerm]);

    const FormattedText = ({ text }) => {
        if (!text) return null;
        const str = text.toString();
        // Regex to match _ followed by one or more alphanumeric characters
        const parts = str.split(/(_[a-zA-Z0-9]+)/g);
        return (
            <>
                {parts.map((part, i) => (
                    part.startsWith('_') ? (
                        <sub key={i} className="text-[0.8em] leading-none">{part.slice(1)}</sub>
                    ) : (
                        part
                    )
                ))}
            </>
        );
    };

    const scrollToSection = (titleText) => {
        if (!titleText) return;
        
        // Try to find the section by text content in h2/h3
        const elements = document.querySelectorAll('h2, h3, span');
        for (const el of elements) {
            const text = el.textContent || '';
            if (text.trim() === titleText.trim() || text.includes(titleText)) {
                // Find the closest scroll-mt container or the element itself
                const container = el.closest('.scroll-mt-20') || el;
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Visual Feedback Animation
                setTimeout(() => {
                    container.classList.add('ring-2', 'ring-blue-500/50', 'bg-blue-500/5', 'transition-all', 'duration-1000');
                    setTimeout(() => {
                        container.classList.remove('ring-2', 'ring-blue-500/50', 'bg-blue-500/5');
                    }, 2000);
                }, 600);
                return;
            }
        }
    };

    useEffect(() => {
        const handleScrollEvent = (e) => {
            if (e.detail?.title) {
                scrollToSection(e.detail.title);
            }
        };
        window.addEventListener('scroll-to-section', handleScrollEvent);

        // Handle initial hash navigation
        if (window.location.hash) {
            const hashTitle = decodeURIComponent(window.location.hash.substring(1));
            // Small delay to ensure data is rendered
            const timer = setTimeout(() => scrollToSection(hashTitle), 800);
            return () => clearTimeout(timer);
        }

        return () => window.removeEventListener('scroll-to-section', handleScrollEvent);
    }, [loading]);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const Highlight = ({ text, query }) => {
        if (!text) return null;
        if (!query) return <FormattedText text={text} />;

        const str = text.toString();
        const parts = str.split(new RegExp(`(${query})`, 'gi'));

        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={i} className="bg-blue-500/40 text-white rounded-sm px-0.5">{part}</mark>
                    ) : (
                        <FormattedText key={i} text={part} />
                    )
                )}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-black text-gray-400 p-1 sm:p-4 lg:p-6 selection:bg-blue-500/30">
            <div className="max-w-[1920px] mx-auto w-full px-1 sm:px-4">

                <div className="relative mb-4 sm:mb-6 mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-stretch gap-3">
                            <div className="flex select-none">
                                <div className="w-1.5 sm:w-2 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] self-stretch min-h-[1.5rem] sm:min-h-[2rem]"></div>
                            </div>
                            <h1 className="text-[19px] sm:text-[25.5px] font-bold text-white tracking-widest uppercase py-1">
                                <Highlight text={title} query={searchTerm} />
                            </h1>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <div
                                ref={searchRef}
                                className={`relative transition-all duration-300 ease-in-out ${isSearchOpen ? 'w-full sm:w-[280px]' : ''}`}
                            >
                                <div
                                    onClick={() => setIsSearchOpen(true)}
                                    className={`flex items-center bg-gray-900/50 border border-gray-800 transition-all duration-300 ${isSearchOpen ? 'border-blue-500/50 pr-4 h-9' : 'cursor-pointer hover:border-gray-700 w-9 h-9'}`}
                                >
                                    <div className="flex items-center justify-center w-9 h-9 flex-shrink-0">
                                        <svg className={`w-4 h-4 transition-colors ${isSearchOpen ? 'text-blue-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="SEARCH..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onFocus={() => setIsSearchOpen(true)}
                                        className={`bg-transparent border-none text-white text-[12px] py-1.5 focus:outline-none transition-all duration-300 tracking-widest placeholder:text-gray-700 w-full ${isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none w-0'}`}
                                    />
                                    {searchTerm && isSearchOpen && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSearchTerm('');
                                            }}
                                            className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (scrollY > 400) {
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    } else {
                                        setIsNavOpen(true);
                                    }
                                }}
                                className="w-9 h-9 bg-gray-900/50 border border-gray-800 flex items-center justify-center transition-all hover:border-emerald-500/50 group/nav flex-shrink-0"
                                title="TECHNICAL STANDARDS"
                            >
                                <BookOpen size={16} className={`transition-colors ${scrollY > 400 ? 'text-emerald-400' : 'text-gray-500 group-hover/nav:text-emerald-400'}`} />
                            </button>

                            {csvFile === 'PRD' && (
                                <button
                                    onClick={handleSave}
                                    title="SAVE SETTINGS"
                                    className="w-9 h-9 bg-gray-900/50 border border-gray-800 flex items-center justify-center transition-all hover:border-blue-500/50 group/save flex-shrink-0"
                                >
                                    <Save size={16} className="text-gray-500 group-hover/save:text-blue-500 transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {toast.show && (
                    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border backdrop-blur-md shadow-2xl min-w-[320px] ${toast.type === 'error'
                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                            : 'border-green-500/50 bg-green-500/10 text-green-400'
                            }`}>
                            <div className="shrink-0">
                                {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                            </div>
                            <div className="flex-1 text-sm font-medium tracking-tight whitespace-pre-wrap">{toast.message}</div>
                            <button
                                onClick={() => setToast(prev => ({ ...prev, show: false }))}
                                className="p-1 hover:brightness-125 opacity-60 hover:opacity-100 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {csvFile === 'PRD' && !searchTerm && <PrdTheory />}
                {csvFile === 'GEN' && !searchTerm && <GeneratorTheoryMain />}
                {csvFile === 'UPS' && !searchTerm && <UpsTheory />}
                {csvFile === 'CB' && !searchTerm && <CbTheory />}
                {csvFile === 'XLPE' && !searchTerm && <XlpeTheory />}
                {csvFile === 'CT' && !searchTerm && <CtTheory />}
                {csvFile === 'RX' && !searchTerm && <RxTheory />}
                {csvFile === 'OD' && !searchTerm && <OdTheory />}
                {csvFile === 'PL' && !searchTerm && <PlTheory />}

                <div className="space-y-12">
                    {csvFile !== 'UPS' ? (
                        filteredSections.length > 0 ? filteredSections.map((section, sIndex) => {
                            const showGroupTitle = section.groupTitle && (sIndex === 0 || filteredSections[sIndex - 1].groupTitle !== section.groupTitle);
                            const isSubTitleRedundant = section.subTitle && section.groupTitle && section.subTitle.trim() === section.groupTitle.trim();
                            const isCardTitleRedundant =
                                (section.subTitle && section.cardTitle.trim() === section.subTitle.trim()) ||
                                (section.groupTitle && section.cardTitle.trim() === section.groupTitle.trim());

                            const sectionId = `section-${sIndex}`;

                            return (
                                <div key={sIndex} id={sectionId} className={`${showGroupTitle ? "pt-8 scroll-mt-20" : "scroll-mt-20"} ${csvFile === 'GEN' && section.groupTitle === 'DIESEL GENERATOR SET' ? 'mt-24 pt-8' : ''}`}>
                                    {showGroupTitle && (
                                        <div className="mb-8">
                                            <h2 className={`text-lg sm:text-xl font-bold tracking-widest flex items-center gap-3 ${
                                                ['XLPE', 'CB', 'RX', 'OD', 'PL', 'PRD'].includes(csvFile)
                                                    ? 'text-white'
                                                    : 'text-white/90 border-l-4 border-blue-600 pl-4'
                                            }`}>
                                                {['XLPE', 'CB', 'RX', 'OD', 'PL', 'PRD'].includes(csvFile) && (
                                                    <div className="w-1 sm:w-1.5 bg-blue-600 self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                                                )}
                                                <Highlight text={section.groupTitle} query={searchTerm} />
                                            </h2>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {(section.subTitle && !isSubTitleRedundant) && (
                                            <div className={`flex items-center gap-2 mb-2 font-bold px-2 ${
                                                ['XLPE', 'CB', 'RX', 'OD', 'PL', 'PRD'].includes(csvFile)
                                                    ? 'text-white text-[14px] sm:text-[16px] tracking-normal sm:tracking-wider uppercase'
                                                    : `${['OD', 'CT', 'PL', 'PRD', 'GEN'].includes(csvFile) ? 'text-white' : 'text-blue-500'} text-[13px] sm:text-[16px] tracking-normal sm:tracking-wider`
                                            }`}>
                                                {csvFile === 'CB' ? (
                                                    <Shield size={16} className="text-blue-500 shrink-0" />
                                                ) : ['XLPE', 'RX', 'OD', 'PL', 'PRD'].includes(csvFile) ? (
                                                    <Activity size={16} className="text-blue-500 shrink-0" />
                                                ) : csvFile === 'CT' ? (
                                                    <Zap size={16} className="text-blue-500 shrink-0" />
                                                ) : (
                                                    <span className="w-0.5 sm:w-1 bg-blue-500/50 flex-shrink-0 self-stretch min-h-[0.75rem] py-0.5"></span>
                                                )}
                                                <span className="py-0.5"><Highlight text={section.subTitle} query={searchTerm} /></span>
                                            </div>
                                        )}

                                        {csvFile === 'GEN' && (
                                            <div className="flex items-center gap-2 mb-2 px-2">
                                                <Activity size={16} className="text-blue-500" />
                                                <h3 className="text-sm font-bold text-gray-300 tracking-widest uppercase">
                                                    <Highlight text={section.cardTitle || title} query={searchTerm} />
                                                </h3>
                                            </div>
                                        )}

                                        <div className="border border-gray-900 bg-black relative overflow-hidden group">
                                            <CornerBorders />

                                            {(!isCardTitleRedundant && csvFile !== 'GEN') && (
                                                <div className="border-b border-gray-900 px-6 py-3 flex justify-between items-center bg-gray-900/10">
                                                    <h2 className="text-white font-bold text-[13px] sm:text-[14px] tracking-tight sm:tracking-wider mr-2 flex items-center gap-2">
                                                        {['XLPE', 'RX', 'OD', 'PL', 'PRD'].includes(csvFile) && <Activity size={14} className="text-blue-500 shrink-0" />}
                                                        <Highlight text={section.cardTitle} query={searchTerm} />
                                                    </h2>
                                                    <div className="text-[10px] text-gray-700 tracking-tighter">SEC_{sIndex + 1}</div>
                                                </div>
                                            )}

                                            <div className="overflow-x-auto custom-scrollbar">
                                                {section.type === 'custom-fuse' ? (
                                                    <div className="p-2 space-y-8">
                                                        <div>
                                                            <div className="mb-2 px-1 flex items-center gap-2">
                                                                <div className="w-0.5 h-3 bg-blue-500/50"></div>
                                                                <div className="text-[11px] sm:text-[12px] font-bold text-white uppercase tracking-widest">
                                                                    24kV 한류형 퓨즈 정격전류
                                                                </div>
                                                            </div>
                                                            <div className="w-full border border-gray-800 bg-gray-900/10 overflow-x-auto custom-scrollbar">
                                                                <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] divide-x divide-gray-800 bg-gray-900/30 w-[466.66%] sm:w-[233.33%]">
                                                                    {['5A/40kA', '10A/40kA', '16A/40kA', '20A/40kA', '25A/40kA', '30A/40kA', '40A/40kA', '50A/40kA', '63A/40kA', '75A/25kA', '100A/25kA', '125A/25kA', '160A/25kA', '200A/25kA'].map((rating, idx) => (
                                                                        <div key={idx} className="h-[40px] flex items-center justify-center text-[12px] sm:text-[13px] font-bold text-[#d1d5db] whitespace-nowrap px-1">
                                                                            {rating}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 px-1 text-gray-500 text-[11px] sm:text-[12px] font-medium leading-relaxed">
                                                                * 국내 제조사(LS ELECTRIC, 현대일렉트릭 등)
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-2 px-1 flex items-center gap-2">
                                                                <div className="w-0.5 h-3 bg-blue-500/50"></div>
                                                                <div className="text-[11px] sm:text-[12px] font-bold text-white uppercase tracking-widest">
                                                                    변압기 용량별 배율조절
                                                                </div>
                                                            </div>
                                                            <div className="w-full border border-gray-800 bg-gray-900/10 overflow-x-auto custom-scrollbar">
                                                                <div className="w-[200%] sm:w-full">
                                                                    <div className="grid grid-cols-6 divide-x divide-gray-800 border-b border-gray-800 bg-gray-900/30 w-full">
                                                                        {Object.keys(fuseSettings).map((label, idx) => (
                                                                            <div key={idx} className="h-[40px] px-0.5 flex items-center justify-center text-[10px] sm:text-[12px] font-bold text-[#d1d5db] text-center uppercase tracking-wider leading-snug whitespace-nowrap">
                                                                                {label}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="grid grid-cols-6 divide-x divide-gray-800 w-full">
                                                                        {Object.entries(fuseSettings).map(([label, value], idx) => (
                                                                            <div key={idx} className="h-[40px] flex items-center justify-center bg-gray-900/10 relative group/select">
                                                                                <div className="relative w-full h-full flex items-center justify-center">
                                                                                    <select
                                                                                        value={value}
                                                                                        onChange={(e) => setFuseSettings(prev => ({ ...prev, [label]: parseFloat(e.target.value) }))}
                                                                                        className="appearance-none bg-transparent border-none text-[#d1d5db] text-[13px] sm:text-[13px] font-bold h-full w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                                                                        style={{ textAlignLast: 'center' }}
                                                                                    >
                                                                                        {[1.25, 1.5, 2, 2.25, 2.5].map(v => (
                                                                                            <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 px-1 text-gray-500 text-[11px] sm:text-[12px] font-medium leading-relaxed">
                                                                *단, 제작사 표준 및 보호협조 검토 결과에 따라 조정할 수 있다.
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-2 space-y-4">

                                                        {(() => {
                                                            const colCount = section.headers[0]?.length || 0;
                                                            const allRows = [...section.headers, ...section.rows];
                                                            const hasLongContent = allRows.some(row => row.some(cell => cell?.toString().includes('㎟')));

                                                            let maxChars = 0;
                                                            allRows.forEach(row => {
                                                                row.forEach(cell => {
                                                                    if (cell) {
                                                                        const len = cell.toString().trim().length;
                                                                        if (len > maxChars) maxChars = len;
                                                                    }
                                                                });
                                                            });

                                                            const unifiedColWidth = Math.max(80, maxChars * 10 + 20);
                                                            const mobileMinW = colCount * unifiedColWidth;

                                                            const isDarkHeaderBase = [
                                                                'POWER SYSTEM STANDARDS BY TRANSFORMER',
                                                                'TRANSFORMER CHARACTERISTICS',
                                                                '단상2선 Circuit Breaker',
                                                                '3상3선 Circuit Breaker',
                                                                '3상4선 Circuit Breaker',
                                                                '단심 CABLE IMPEDANCE [Ω/Km]',
                                                                '다심 CABLE IMPEDANCE [Ω/Km]',
                                                                'HFIX IMPEDANCE [Ω/Km]',
                                                                '1) 0.6/1kV FW-CV, F-CV, HFCO, CV',
                                                                '2) 0.6/1kV F-FR-8, NFR-8',
                                                                '3) 0.6/1kV F-GV',
                                                                '4) 450/750V HFIX+, HFIX',
                                                                '5) 0.6/1kV F-GV 선정',
                                                                '1) CD 합성수지 가요전선관',
                                                                '2) HI 경질 폴리염화비닐(PVC)',
                                                                '3) ST 스틸 전선관(아연도금)',
                                                                '4) ELP 파상형 경질 폴리에틸렌 지중 전선관',
                                                                'Low-Range Current Standard',
                                                                'Medium-Range Current Standard',
                                                                'High-Range Current Standard',
                                                                '단상2선 누전차단기 (ELCB)',
                                                                '3상3선 누전차단기 (ELCB)',
                                                                '3상4선 누전차단기 (ELCB)',
                                                                '단상2선 배선용차단기 (MCCB)',
                                                                '3상3선 배선용차단기 (MCCB)',
                                                                '3상4선 배선용차단기 (MCCB)',
                                                                '1φ - 공사방법에 따른 허용전류',
                                                                '3φ - 공사방법에 따른 허용전류',
                                                                '기중차단기 (Air Circuit Breaker)',
                                                                '진공차단기 (Vacuum Circuit Breaker)',
                                                                'HYUNDAI DOOSAN ENGINE',
                                                                'Diesel Generator Air Intake/Exhaust'
                                                            ].some(t => {
                                                                const checkTitle = (section.cardTitle || title || '').trim();
                                                                return checkTitle === t || checkTitle.includes(t);
                                                            });

                                                            const isKFactor = (section.cardTitle || title || '').includes('발전기 허용전압강하계수');
                                                            const isDarkHeader = isDarkHeaderBase || isKFactor;

                                                            return (
                                                                <table
                                                                    className="w-full border-collapse table-fixed sm:min-w-[800px]"
                                                                    style={typeof isMobile !== 'undefined' && isMobile ? { minWidth: `${mobileMinW}px` } : {}}
                                                                >
                                                                    <colgroup>{Array.from({ length: colCount }).map((_, idx) => {
                                                                        if (hasLongContent) {
                                                                            const isCurrentCapacityCol = section.headers.some(h => h[idx]?.toString().includes('허용전류'));
                                                                            const isSizeCol = section.headers.some(h => h[idx]?.toString().includes('㎟'));
                                                                            const isPTCol = section.headers.some(h => h[idx]?.toString().trim() === 'PT');

                                                                            if (isCurrentCapacityCol) return <col key={idx} style={{ width: '6%' }} />;
                                                                            if (isSizeCol) return <col key={idx} style={{ width: '11%' }} />;
                                                                            if (isPTCol) return <col key={idx} style={{ width: '10%' }} />;
                                                                        }
                                                                        return <col key={idx} />;
                                                                    })}</colgroup>
                                                                    <thead>
                                                                        {(() => {
                                                                            const isFirstColumnEmptyInAllHeaders = section.headers.every(h => !h[0] || h[0].toString().trim() === '');
                                                                            return section.headers.map((hRow, hrIndex) => {
                                                                                const getHeaderCells = (row) => {
                                                                                    const cells = [];
                                                                                    for (let i = 0; i < row.length; i++) {
                                                                                        let cell = row[i]?.toString().trim() || '';
                                                                                        if (cell.includes("x''d [%]")) {
                                                                                            cell = cell.replace("x''d [%]", "X_d'' [%]");
                                                                                        }
                                                                                        if (cell !== '') {
                                                                                            let colSpan = 1;
                                                                                            let j = i + 1;
                                                                                            while (j < row.length && (!row[j] || row[j].toString().trim() === '')) {
                                                                                                colSpan++;
                                                                                                j++;
                                                                                            }
                                                                                            cells.push({ text: cell, colSpan, index: i });
                                                                                            i = j - 1;
                                                                                        } else {
                                                                                            cells.push({ text: '', colSpan: 1, index: i });
                                                                                        }
                                                                                    }
                                                                                    return cells;
                                                                                };

                                                                                const headerCells = getHeaderCells(hRow);

                                                                                return (
                                                                                    <tr
                                                                                        key={hrIndex}
                                                                                        className={`border-b ${isDarkHeader ? 'border-[#111827]' : 'border-gray-900'}`}
                                                                                        style={isDarkHeader ? { backgroundColor: '#030712' } : {}}
                                                                                    >
                                                                                        {headerCells.map((cell, cIndex) => {
                                                                                            if (isFirstColumnEmptyInAllHeaders && cell.index === 0) {
                                                                                                if (hrIndex === 0) {
                                                                                                    return (
                                                                                                        <th
                                                                                                            key={cIndex}
                                                                                                            colSpan={cell.colSpan}
                                                                                                            rowSpan={section.headers.length}
                                                                                                            className={`px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center tracking-wider border-r ${isKFactor ? 'bg-gray-800/80 border-[#111827]' : isDarkHeader ? 'bg-[#030712] border-[#111827]' : 'bg-gray-900/40 border-gray-900'} last:border-r-0`}
                                                                                                        >
                                                                                                            <Highlight text={cell.text} query={searchTerm} />
                                                                                                        </th>
                                                                                                    );
                                                                                                }
                                                                                                return null;
                                                                                            }

                                                                                            return (
                                                                                                <th
                                                                                                    key={cIndex}
                                                                                                    colSpan={cell.colSpan}
                                                                                                    className={`px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center tracking-wider border-r ${isKFactor ? 'bg-gray-800/80 border-[#111827]' : isDarkHeader ? 'bg-[#030712] border-[#111827]' : 'bg-gray-900/40 border-gray-900'} last:border-r-0`}
                                                                                                >
                                                                                                    <Highlight text={cell.text} query={searchTerm} />
                                                                                                </th>
                                                                                            );
                                                                                        })}
                                                                                    </tr>
                                                                                );
                                                                            });
                                                                        })()}
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-900">
                                                                        {section.rows.map((row, rIndex) => {
                                                                            const targetKVAs = [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 750, 1000, 1250, 1500];
                                                                            const isTransformerTable = section.cardTitle === 'POWER SYSTEM STANDARDS BY TRANSFORMER';
                                                                            const isHighlightedRow = isTransformerTable && targetKVAs.includes(parseInt(row[0]));

                                                                            return (
                                                                                <tr key={rIndex} className="hover:bg-blue-500/10 transition-colors group/row">
                                                                                    {row.map((cell, cIndex) => {
                                                                                        const formatValue = (val) => {
                                                                                            if (!val || isNaN(val) || val.toString().trim() === '') return val;
                                                                                            const num = parseFloat(val);
                                                                                            if (num % 1 === 0) return num.toString();
                                                                                            return Math.round(num * 100) / 100;
                                                                                        };

                                                                                        const getCellStyles = () => {
                                                                                            const base = "px-2 py-2 text-center text-[12px] sm:text-[13px] border-r border-gray-900 last:border-r-0";
                                                                                            if (isHighlightedRow) {
                                                                                                if (cIndex === 0) return `${base} text-blue-400 font-bold bg-[#030712]`;
                                                                                                return `${base} text-[#d1d5db] font-medium group-hover/row:text-white`;
                                                                                            }
                                                                                            if (cIndex === 0) {
                                                                                                const bgColor = csvFile === 'GEN' ? 'bg-[#030712]' : 'bg-gray-900/20';
                                                                                                return `${base} text-white font-bold ${bgColor}`;
                                                                                            }
                                                                                            return `${base} text-gray-200 group-hover/row:text-white`;
                                                                                        };

                                                                                        return (
                                                                                            <td
                                                                                                key={cIndex}
                                                                                                className={getCellStyles()}
                                                                                            >
                                                                                                <Highlight text={formatValue(cell)} query={searchTerm} />
                                                                                            </td>
                                                                                        );
                                                                                    })}
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {csvFile === 'GEN' && sIndex === 0 && (
                                            <GeneratorReactanceTheory searchTerm={searchTerm} />
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="py-20 text-center">
                                <div className="text-gray-600 text-sm tracking-[0.2em] uppercase">No matching data found</div>
                            </div>
                        )
                    ) : null}

                    {/* [NEW] 비상용 예비발전설비 연결 부하의 구분 표 추가 */}
                    {csvFile === 'GEN' && !searchTerm && (
                        <>
                            <GeneratorSetTable />
                            <GeneratorLoadClassification />
                        </>
                    )}

                    {/* [NEW] 발전기 출력 등급 이론 추가 섹션 */}
                    {csvFile === 'GEN' && !searchTerm && (
                        <GeneratorRatingTheory />
                    )}
                </div>

                <div className="mt-16 pb-8 text-center text-gray-800 text-[9px] tracking-[0.4em] uppercase">
                    KELC_SYSTEM_DATA_TERMINAL_V1.0
                </div>
            </div>

            {/* Floating Scroll to Theory Button */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`fixed bottom-8 right-8 z-[100] w-12 h-12 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-xl flex items-center justify-center shadow-2xl transition-all duration-500 group hover:bg-blue-600/40 hover:scale-110 active:scale-95 ${
                    scrollY > 600 ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'
                }`}
                title="Scroll to Technical Guide"
            >
                <BookOpen size={20} className="text-blue-400 group-hover:text-white transition-colors" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-20" />
            </button>

            <MasterNavModal 
                isOpen={isNavOpen}
                onClose={() => setIsNavOpen(false)}
            />
        </div>
    );
};

export default DataViewer;
