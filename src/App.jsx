import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader2, FileText, Video, Download, Moon, Sun, Maximize2, X as CloseIcon, Award, Mic, MicOff, Sparkles, History, Lightbulb, ExternalLink, Settings, Plus, Trash2 } from 'lucide-react';
import Confetti from './components/Confetti';
import Toast from './components/Toast';
import FormattedTicket from './components/FormattedTicket';
import TicketSkeleton from './components/TicketSkeleton';
import SearchableSelect from './components/SearchableSelect';

// Helper function to detect deployment platform and get API endpoint
// This must be called at runtime, not at module load time
const getApiEndpoint = (functionName) => {
  // Check for explicit API URL override (highest priority)
  if (import.meta.env.VITE_API_URL) {
    const baseUrl = import.meta.env.VITE_API_URL;
    // Replace the function name in the URL if it exists
    return baseUrl.includes('generate-ticket') 
      ? baseUrl.replace('generate-ticket', functionName)
      : `${baseUrl}/${functionName}`;
  }
  
  // Check for explicit platform override via environment variable
  if (import.meta.env.VITE_PLATFORM === 'vercel') {
    return `/api/${functionName}`;
  }
  if (import.meta.env.VITE_PLATFORM === 'netlify') {
    return `/.netlify/functions/${functionName}`;
  }
  
  // Local development
  if (!import.meta.env.PROD) {
    return `http://localhost:3001/api/${functionName}`;
  }
  
  // Production: detect platform by hostname at runtime
  try {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname.toLowerCase();
      const href = window.location.href.toLowerCase();
      
      console.log('🔍 Platform detection - hostname:', hostname, 'href:', href);
      
      // Check for Vercel domains (including preview URLs)
      // Vercel URLs can be: *.vercel.app, *.vercel.com, or *-*-*-*.vercel.app (preview)
      const isVercel = hostname.includes('vercel.app') || 
          hostname.includes('vercel.com') ||
          href.includes('vercel.app') ||
          href.includes('vercel.com') ||
          hostname.endsWith('.vercel.app') ||
          hostname.endsWith('.vercel.com');
      
      if (isVercel) {
        console.log('✅ Detected Vercel platform, using /api/ endpoint');
        return `/api/${functionName}`;
      }
      
      // Check for Netlify domains
      const isNetlify = hostname.includes('netlify.app') || 
          hostname.includes('netlify.com') ||
          href.includes('netlify.app') ||
          href.includes('netlify.com') ||
          hostname.endsWith('.netlify.app') ||
          hostname.endsWith('.netlify.com');
      
      if (isNetlify) {
        console.log('✅ Detected Netlify platform, using /.netlify/functions/ endpoint');
        return `/.netlify/functions/${functionName}`;
      }
      
      // If we can't detect, log for debugging
      console.warn('⚠️ Could not detect platform from hostname:', hostname, 'Defaulting to Vercel');
    }
    
    // Default fallback: ALWAYS use Vercel in production if detection fails
    // (since user is deploying to Vercel)
    console.warn('⚠️ Using default Vercel endpoint (detection failed)');
    return `/api/${functionName}`;
  } catch (e) {
    console.error('❌ Error detecting platform:', e);
    // Fallback to Vercel if detection fails
    return `/api/${functionName}`;
  }
};

// API endpoint - will be set at runtime when function is called
// We'll call getApiEndpoint() each time to ensure fresh detection

// Enhanced encryption/decryption for localStorage
// NOTE: This is obfuscation, not true encryption. Sensitive data like API tokens
// should ideally be stored server-side or in secure session storage.
// We use a stronger XOR cipher with per-device fingerprint and salt.

const getDeviceFingerprint = () => {
  // Create a semi-persistent device fingerprint (not truly unique, but better than hardcoded)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  const fingerprint = canvas.toDataURL().substring(0, 50);
  
  // Combine with navigator properties
  const combined = fingerprint + 
    (navigator.userAgent || '') + 
    (navigator.language || '') + 
    (screen.colorDepth || '') + 
    (new Date().getTimezoneOffset() || '');
  
  // Hash it to a consistent length
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

const STORAGE_KEY = 'wsbug_k3y_2024_v2'; // Base obfuscation key

const encryptData = (data) => {
  if (!data) return '';
  try {
    const deviceKey = getDeviceFingerprint();
    const combinedKey = STORAGE_KEY + deviceKey;
    
    // Add random salt (store with encrypted data)
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Encrypt: salt + data
    const dataWithSalt = salt + data;
    const encrypted = btoa(String.fromCharCode(...new TextEncoder().encode(dataWithSalt).map((byte, i) => {
      const keyByte = combinedKey.charCodeAt(i % combinedKey.length);
      const saltByte = parseInt(salt.substring((i % 8) * 2, (i % 8) * 2 + 2), 16);
      return byte ^ keyByte ^ saltByte;
    })));
    
    return encrypted;
  } catch {
    return data; // Fallback to plaintext if encryption fails
  }
};

// Helper to check if a string looks like encrypted/binary data
const looksLikeEncrypted = (str) => {
  if (!str) return false;
  // Check for non-printable characters (binary data)
  // Jira API tokens are base64-like and can be any length, so don't check length
  const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/;
  return nonPrintableRegex.test(str);
};

const decryptData = (encrypted) => {
  if (!encrypted) return '';
  
  // If it doesn't look encrypted (no base64 padding, looks like plain text), return as-is
  if (!encrypted.includes('=') && !looksLikeEncrypted(encrypted) && encrypted.length < 50) {
    // Might be stored unencrypted
    return encrypted;
  }
  
  try {
    const deviceKey = getDeviceFingerprint();
    const combinedKey = STORAGE_KEY + deviceKey;
    
    // First decrypt to get salt + data
    const decoded = atob(encrypted);
    const decrypted = new TextDecoder().decode(new Uint8Array(
      decoded.split('').map((char, i) => {
        const keyByte = combinedKey.charCodeAt(i % combinedKey.length);
        return char.charCodeAt(0) ^ keyByte;
      })
    ));
    
    // Extract salt (first 16 characters)
    const salt = decrypted.substring(0, 16);
    
    // Decrypt the data part with salt
    const finalData = Array.from(decrypted.substring(16)).map((char, i) => {
      const saltByte = parseInt(salt.substring(((i + 16) % 8) * 2, ((i + 16) % 8) * 2 + 2), 16);
      return String.fromCharCode(char.charCodeAt(0) ^ saltByte);
    }).join('');
    
    // Validate decrypted data - should not contain non-printable characters
    if (looksLikeEncrypted(finalData)) {
      console.warn('Decrypted data looks encrypted, trying old method');
      throw new Error('Decrypted data validation failed');
    }
    
    return finalData;
  } catch (error) {
    // Try old decryption method for backwards compatibility
    try {
      const decoded = atob(encrypted);
      const decrypted = new TextDecoder().decode(new Uint8Array(
        decoded.split('').map((char, i) => 
          char.charCodeAt(0) ^ STORAGE_KEY.charCodeAt(i % STORAGE_KEY.length)
        )
      ));
      
      // Validate decrypted data
      if (looksLikeEncrypted(decrypted)) {
        console.error('Decryption failed - result looks encrypted');
        return ''; // Return empty instead of encrypted value
      }
      
      return decrypted;
    } catch (e) {
      console.error('All decryption methods failed:', e);
      // Return empty string instead of encrypted value to prevent sending garbage
      return '';
    }
  }
};

// Sanitize text input to prevent XSS
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitize filename to prevent path traversal
const sanitizeFileName = (filename) => {
  if (!filename) return 'file';
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove special chars
    .replace(/\.{2,}/g, '.') // Remove multiple dots
    .substring(0, 255); // Limit length
};

export default function BugTrackerApp() {
  const [bugDescription, setBugDescription] = useState('');
  const [files, setFiles] = useState([]); // Changed to array for multiple files
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [originalTicket, setOriginalTicket] = useState(null); // Store original AI-generated ticket
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editedTicket, setEditedTicket] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [wordCount, setWordCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    return savedDarkMode === 'true';
  });
  const [isDragging, setIsDragging] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef(null);
  const [loadingStep, setLoadingStep] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [qualityScore, setQualityScore] = useState(null);
  
  // New feature states
  const [showHistory, setShowHistory] = useState(false);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const recognitionRef = useRef(null);
  const countdownIntervalRef = useRef(null); // Track countdown interval for cleanup
  
  // Jira integration states
  const [showJiraSettings, setShowJiraSettings] = useState(false);
  const [showTicketFormatSettings, setShowTicketFormatSettings] = useState(false);
  // Load Jira config from localStorage
  const loadJiraConfig = () => {
    try {
      // Get token directly from localStorage
      const storedToken = localStorage.getItem('jiraApiToken');
      let apiToken = '';
      
      if (storedToken) {
        // Check if it looks like encrypted data (has non-printable characters)
        if (looksLikeEncrypted(storedToken)) {
          // Try to decrypt (for backwards compatibility with old encrypted tokens)
          try {
            const decrypted = decryptData(storedToken);
            if (decrypted && !looksLikeEncrypted(decrypted)) {
              apiToken = decrypted;
            } else {
              // Decryption failed or produced garbage
              console.warn('Token decryption failed, using empty token');
              apiToken = '';
            }
          } catch (e) {
            console.warn('Error decrypting token:', e);
            apiToken = '';
          }
        } else {
          // Token is stored as plain text - use it directly
          apiToken = storedToken;
        }
      }
      
      const config = {
    url: localStorage.getItem('jiraUrl') || 'https://workspan.atlassian.net/',
    email: localStorage.getItem('jiraEmail') || '',
        apiToken: apiToken,
    projectKey: localStorage.getItem('jiraProjectKey') || '',
    instance: localStorage.getItem('jiraInstance') || '',
    productLine: localStorage.getItem('jiraProductLine') || '',
    component: localStorage.getItem('jiraComponent') || '',
        foundVersion: localStorage.getItem('jiraFoundVersion') || '',
        engineeringTeam: localStorage.getItem('jiraEngineeringTeam') || ''
      };
      
      console.log('Loaded Jira config:', {
        url: config.url,
        email: config.email,
        apiTokenLength: config.apiToken ? config.apiToken.length : 0,
        apiTokenPresent: !!config.apiToken,
        storedTokenLength: storedToken ? storedToken.length : 0
      });
      
      return config;
    } catch (error) {
      console.error('Error loading Jira config:', error);
      return {
        url: localStorage.getItem('jiraUrl') || 'https://workspan.atlassian.net/',
        email: localStorage.getItem('jiraEmail') || '',
        apiToken: '',
        projectKey: localStorage.getItem('jiraProjectKey') || '',
        instance: localStorage.getItem('jiraInstance') || '',
        productLine: localStorage.getItem('jiraProductLine') || '',
        component: localStorage.getItem('jiraComponent') || '',
        foundVersion: localStorage.getItem('jiraFoundVersion') || '',
        engineeringTeam: localStorage.getItem('jiraEngineeringTeam') || ''
      };
    }
  };

  const [jiraConfig, setJiraConfig] = useState(loadJiraConfig());
  const [isPushingToJira, setIsPushingToJira] = useState(false);
  const [jiraPushStep, setJiraPushStep] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Environment Configuration state
  const loadEnvironmentConfig = () => {
    try {
      const saved = localStorage.getItem('environmentConfig');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading environment config:', e);
    }
    return {
      instance: 'https://workspan-staging-2.qa.workspan.app/',
      branch: '',
      username: '',
      password: '',
      customFields: []
    };
  };

  const [environmentConfig, setEnvironmentConfig] = useState(loadEnvironmentConfig());

  // Default ticket format fields
  const DEFAULT_TICKET_FIELDS = [
    { id: 'title', name: 'Title', enabled: true, isDefault: true },
    { id: 'description', name: 'Description', enabled: true, isDefault: true },
    { id: 'steps', name: 'Steps to Reproduce', enabled: true, isDefault: true },
    { id: 'expected', name: 'Expected Behaviour', enabled: true, isDefault: true },
    { id: 'actual', name: 'Actual Behaviour', enabled: true, isDefault: true },
    { id: 'impact', name: 'Impact', enabled: true, isDefault: true },
    { id: 'priority', name: 'Priority', enabled: true, isDefault: true },
    { id: 'environment', name: 'Environment', enabled: true, isDefault: true },
    { id: 'attachment', name: 'Attachment', enabled: true, isDefault: true }
  ];

  // Ticket format configuration
  const [ticketFormat, setTicketFormat] = useState(() => {
    const saved = localStorage.getItem('ticketFormat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_TICKET_FIELDS;
      }
    }
    return DEFAULT_TICKET_FIELDS;
  });
  const [draggedField, setDraggedField] = useState(null);

  // Jira dropdown options
  const JIRA_INSTANCES = ['Prod', 'UAT', 'VMWare UAT', 'Cisco-QA', 'QA', 'Demo', 'Cisco PS Dev', 'Cisco PS Test', 'Cisco UAT'];
  const JIRA_PRODUCT_LINES = ['AI Teammates', 'Co-Sell Ecosystem', 'Co-Sell Hyperscaler', 'Marketplace', 'CTG', 'Enterprise', 'CRM', 'Partner Desk'];
  const JIRA_ENGINEERING_TEAMS = ['Centaurus', 'Jarvis (QA team)', 'Polaris', 'PS Team', 'Solaris', 'Spartans', 'SRE', 'Supernova', 'Support Team', 'Tigers', 'Wave', 'Titans', 'Megatron', 'AI Mates', 'Product Management', 'Partner Desk'];
  const JIRA_COMPONENTS = ['100X', '100x Metrics', '100x Reports', '100x Table view', '100x tasks', '1x Metrics', '1x Table view', 'Accept / Decline Flow', 'Access policies', 'ACE API', 'Activity Log', 'Add from CRM', 'Agreement', 'AI', 'AI Teammates', 'apex', 'api', 'App Installer', 'Application Users', 'Archiving Objects', 'ATM - Chat Session', 'ATM - Partner Advantage Panel', 'ATM - SFDC Administration', 'ATM - Teammate Actions', 'ATM - Teammate Insights', 'ATM - Teammate Knowledge Base', 'ATM - Teammate Profile', 'ATM - Teammate Question Prompts', 'ATM- License Management', 'Attachments', 'Auth & Provisioning', 'Auto-Create', 'Auto-Link', 'BPA', 'Breadcrumb', 'calculated field', 'Charts', 'Clone', 'Codacy', 'Company Page', 'Config Manager', 'Contact Details', 'datastore', 'Date & Time', 'db', 'Deal Size', 'Deal Term', 'Digital', 'Email Notification', 'ETL', 'Export', 'Feature flags', 'Field Dependency', 'fileservice', 'Filter & Sort', 'gae', 'go', 'Grid Edit', 'Historical Upload', 'Home', 'Hubspot', 'hubspot_outbound', 'Incoming Referrals', 'Integrations', 'Jenkins', 'Launch flow', 'leads', 'Listing', 'Localization', 'Login', 'marketplace', 'Membership', 'Membership Reports', 'Merge', 'Microsoft Partner Center', 'NA', 'Nav Bar', 'Object Stages', 'Offer', 'One-Object', 'Others', 'Outgoing Flow', 'Overview', 'Partner Program', 'Partner-Split', 'Performance', 'PLI', 'PROD', 'Profile', 'Project currency', 'py3', 'Reference table/lov', 'Report', 'rpc', 'salesforce outbound', 'Salesforce Setup', 'Search', 'Section List', 'security', 'SFDC Embed', 'Share object', 'Single List', 'SSO', 'Staging Table', 'Submit', 'Summary Panel', 'Sync Issue', 'Template', 'UI', 'Upgrades', 'Validation Engine', 'Value Map', 'Wizard', 'Workcenter', 'Workflow'];

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
    // Clear input to allow re-selecting same files
    e.target.value = '';
  };

  const addFiles = (newFiles) => {
    // Filter valid files (images and videos only)
    const validFiles = newFiles.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (validFiles.length === 0) {
      setToast({ message: '❌ Please upload image or video files only', type: 'error' });
      return;
    }

    // Process each file
    const filePromises = validFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            file: file,
            preview: reader.result,
            name: sanitizeFileName(file.name), // Sanitized filename
            type: file.type,
            size: file.size,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}` // Better unique ID
          });
        };
        reader.onerror = () => reject(file);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises)
      .then(processedFiles => {
        setFiles(prev => {
          const updated = [...prev, ...processedFiles];
          // Calculate total inside setState callback to avoid race condition
          setToast({ 
            message: `✅ ${validFiles.length} file(s) uploaded! Total: ${updated.length}/10`, 
            type: 'success' 
          });
          return updated;
        });
      })
      .catch(error => {
        setToast({ message: '❌ Error reading some files. Please try again.', type: 'error' });
      });
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setToast({ message: '🗑️ File removed', type: 'success' });
  };

  const clearAllFiles = () => {
    setFiles([]);
    // Reset file input
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
    setToast({ message: '🗑️ All files cleared', type: 'success' });
  };

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    setBugDescription(value);
    
    // Count words and characters
    const words = value.match(/[a-zA-Z]{2,}/g) || [];
    setWordCount(words.length);
    setCharCount(value.length);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + Enter to generate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generateTicket();
      }
      // ESC to clear
      if (e.key === 'Escape') {
        resetForm();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [bugDescription, files]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Warn before page refresh/close if there's unsaved work
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Show warning if user has work in progress
      if (bugDescription.trim() || files.length > 0 || ticket) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers show this message
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [bugDescription, files, ticket]);

  // Cleanup intervals on component unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Load ticket history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('ticketHistory');
    if (savedHistory) {
      try {
        setTicketHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load ticket history:', e);
      }
    }
    
  }, []);

  // Reload Jira config from localStorage on mount and when localStorage changes
  useEffect(() => {
    const reloadConfig = () => {
      const config = loadJiraConfig();
      
      setJiraConfig(prevConfig => {
        // Always update missing fields from localStorage
        // This ensures that after page refresh, all saved values are loaded into state
        const updated = {
          url: prevConfig.url || config.url,
          email: prevConfig.email || config.email,
          apiToken: prevConfig.apiToken || config.apiToken, // CRITICAL: Load token from localStorage if missing in state
          projectKey: prevConfig.projectKey || config.projectKey,
          instance: prevConfig.instance || config.instance,
          productLine: prevConfig.productLine || config.productLine,
          component: prevConfig.component || config.component,
          foundVersion: prevConfig.foundVersion || config.foundVersion,
          engineeringTeam: prevConfig.engineeringTeam || config.engineeringTeam
        };
        
        // Check if we actually need to update
        const hasChanges = 
          updated.apiToken !== prevConfig.apiToken ||
          updated.email !== prevConfig.email ||
          updated.url !== prevConfig.url ||
          updated.projectKey !== prevConfig.projectKey ||
          updated.instance !== prevConfig.instance ||
          updated.productLine !== prevConfig.productLine ||
          updated.component !== prevConfig.component ||
          updated.foundVersion !== prevConfig.foundVersion ||
          updated.engineeringTeam !== prevConfig.engineeringTeam;
        
        if (hasChanges) {
          console.log('Updating Jira config from localStorage:', {
            apiTokenUpdated: updated.apiToken !== prevConfig.apiToken,
            emailUpdated: updated.email !== prevConfig.email,
            apiTokenLength: updated.apiToken ? updated.apiToken.length : 0
          });
          return updated;
        }
        
        return prevConfig;
      });
    };

    // Reload on mount - this ensures state is populated after page refresh
    reloadConfig();

    // Listen for storage events (when localStorage is updated in another tab)
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('jira')) {
        reloadConfig();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Initialize voice recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      // Use browser's language or default to auto-detect
      // This allows multi-language voice input
      recognitionRef.current.lang = navigator.language || 'en-US';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const newDescription = (bugDescription + ' ' + finalTranscript).trim();
          setBugDescription(newDescription);
          
          // Update word and character counts
          const words = newDescription.match(/[a-zA-Z]{2,}/g) || [];
          setWordCount(words.length);
          setCharCount(newDescription.length);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // Handle different error types with user-friendly messages
        let errorMessage = '';
        switch (event.error) {
          case 'not-allowed':
            errorMessage = '🎤 Microphone permission denied. Please allow microphone access in your browser settings and try again.';
            break;
          case 'no-speech':
            // Don't show error for no-speech, it's normal
            return;
          case 'audio-capture':
            errorMessage = '🎤 No microphone found. Please connect a microphone and try again.';
            break;
          case 'network':
            errorMessage = '🌐 Network error. Please check your internet connection and try again.';
            break;
          case 'aborted':
            // User stopped it, don't show error
            return;
          case 'service-not-allowed':
            errorMessage = '🎤 Speech recognition service not allowed. Please check your browser settings.';
            break;
          default:
            errorMessage = `❌ Voice input error: ${event.error}. Please try again.`;
        }
        
        if (errorMessage) {
          setToast({ message: errorMessage, type: 'error' });
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // AI Auto-Suggestions based on description
  useEffect(() => {
    if (!bugDescription.trim()) {
      setAiSuggestions(null);
      return;
    }

    const debounceTimer = setTimeout(() => {
      const desc = bugDescription.toLowerCase();
      
      // Analyze keywords for suggestions
      let priority = 'P3';
      let impact = 'Medium';
      let tags = [];

      // Critical keywords
      if (desc.match(/crash|critical|production|down|outage|data loss|security/)) {
        priority = 'P1';
        impact = 'Critical';
        tags.push('urgent');
      }
      // High priority keywords
      else if (desc.match(/login|payment|checkout|error|broken|cannot|unable|fails/)) {
        priority = 'P2';
        impact = 'High';
        tags.push('important');
      }
      // Medium priority
      else if (desc.match(/slow|display|ui|layout|mobile/)) {
        priority = 'P3';
        impact = 'Medium';
      }
      // Low priority
      else {
        priority = 'P4';
        impact = 'Low';
      }

      // Add category tags
      if (desc.match(/login|auth|password|signin/)) tags.push('authentication');
      if (desc.match(/button|menu|display|ui|layout/)) tags.push('ui');
      if (desc.match(/api|server|network|request/)) tags.push('backend');
      if (desc.match(/mobile|tablet|responsive/)) tags.push('mobile');
      if (desc.match(/slow|performance|loading/)) tags.push('performance');

      setAiSuggestions({ priority, impact, tags });
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [bugDescription]);

  // Lock body scroll when modals are open
  useEffect(() => {
    if (showJiraSettings || showHistory || showSaveDialog || showTicketFormatSettings) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [showJiraSettings, showHistory, showSaveDialog, showTicketFormatSettings]);

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractVideoFrame = (videoFile) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const videoURL = URL.createObjectURL(videoFile);
      video.src = videoURL;
      
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      });
      
      video.addEventListener('seeked', () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(videoURL);
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            reject(new Error('Failed to extract video frame'));
          }
        }, 'image/jpeg', 0.9);
      });
      
      video.addEventListener('error', () => {
        URL.revokeObjectURL(videoURL);
        reject(new Error('Failed to load video'));
      });
      
      // Seek to 1 second (or 10% of video duration, whichever is smaller)
      video.addEventListener('durationchange', () => {
        const seekTime = Math.min(1, video.duration * 0.1);
        video.currentTime = seekTime;
      });
    });
  };

  // Test Jira Connection
  const testJiraConnection = async () => {
    // Use the current state values (what user sees/enters in the form)
    // If state is empty, reload from localStorage
    let configToUse = {
      url: jiraConfig.url && jiraConfig.url.trim() ? jiraConfig.url.trim() : '',
      email: jiraConfig.email && jiraConfig.email.trim() ? jiraConfig.email.trim() : '',
      apiToken: jiraConfig.apiToken && jiraConfig.apiToken.trim() ? jiraConfig.apiToken.trim() : ''
    };

    // If any field is missing from state, load from localStorage
    if (!configToUse.url || !configToUse.email || !configToUse.apiToken) {
      const currentConfig = loadJiraConfig();
      configToUse = {
        url: configToUse.url || currentConfig.url,
        email: configToUse.email || currentConfig.email,
        apiToken: configToUse.apiToken || currentConfig.apiToken
      };
      
      // Update state with loaded values for UI display
      if (!jiraConfig.apiToken && currentConfig.apiToken) {
        setJiraConfig(prev => ({ ...prev, apiToken: currentConfig.apiToken }));
      }
      if (!jiraConfig.email && currentConfig.email) {
        setJiraConfig(prev => ({ ...prev, email: currentConfig.email }));
      }
      if (!jiraConfig.url && currentConfig.url) {
        setJiraConfig(prev => ({ ...prev, url: currentConfig.url }));
      }
    }

    // Validate required fields for test
    if (!configToUse.url || !configToUse.email || !configToUse.apiToken) {
      if (!configToUse.apiToken) {
        setToast({ 
          message: '⚠️ API Token is missing. Please enter your API token in the field above and try again.', 
          type: 'error' 
        });
      } else if (!configToUse.email) {
        setToast({ 
          message: '⚠️ Email is missing. Please enter your Jira email address.', 
          type: 'error' 
        });
      } else {
      setToast({ message: '⚠️ Please enter Jira URL, Email, and API Token to test connection', type: 'error' });
      }
      return;
    }

    setIsTestingConnection(true);

    try {
      // Use backend proxy to test connection
      const TEST_JIRA_ENDPOINT = getApiEndpoint('test-jira');

      const response = await fetchWithTimeout(TEST_JIRA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jiraUrl: configToUse.url,
          email: configToUse.email,
          apiToken: configToUse.apiToken
        })
      }, 30000); // 30 second timeout

      if (!response.ok) {
        const errorData = await response.json();
        
        // Provide user-friendly error messages
        if (response.status === 401) {
          setToast({ 
            message: '🔐 Authentication failed! Please check your Email and API Token.', 
            type: 'error' 
          });
        } else if (response.status === 403) {
          setToast({ 
            message: '🚫 Access denied! Your account may not have permission to access this Jira instance.', 
            type: 'error' 
          });
        } else if (response.status === 404) {
          setToast({ 
            message: '🔍 Jira instance not found! Please verify your Jira URL.', 
            type: 'error' 
          });
        } else {
          setToast({ 
            message: `❌ Connection failed: ${errorData.error || 'Unknown error'}`, 
            type: 'error' 
          });
        }
        return;
      }

      const data = await response.json();
      
      // Success message with user info
      setToast({ 
        message: `✅ Connected successfully as ${data.displayName || data.emailAddress}!`, 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('Test connection error:', error);
      
      if (error.message.includes('timeout')) {
        setToast({ 
          message: '⏱️ Connection timeout. Please check your Jira URL and try again.', 
          type: 'error' 
        });
      } else {
        setToast({ 
          message: `❌ Connection test failed: ${error.message}`, 
          type: 'error' 
        });
      }
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save Jira Configuration
  const saveJiraConfig = () => {
    // Save all Jira configuration including URL
    localStorage.setItem('jiraUrl', jiraConfig.url);
    localStorage.setItem('jiraEmail', jiraConfig.email);
    // Store API token as plain text (user requested no encryption)
    localStorage.setItem('jiraApiToken', jiraConfig.apiToken);
    localStorage.setItem('jiraProjectKey', jiraConfig.projectKey);
    localStorage.setItem('jiraInstance', jiraConfig.instance);
    localStorage.setItem('jiraProductLine', jiraConfig.productLine);
    localStorage.setItem('jiraComponent', jiraConfig.component);
    localStorage.setItem('jiraFoundVersion', jiraConfig.foundVersion);
    localStorage.setItem('jiraEngineeringTeam', jiraConfig.engineeringTeam);
    // Save environment configuration
    localStorage.setItem('environmentConfig', JSON.stringify(environmentConfig));
    setShowJiraSettings(false);
    setToast({ message: '✅ Jira configuration saved!', type: 'success' });
  };

  // Environment Configuration functions
  const addCustomEnvironmentField = () => {
    const fieldName = prompt('Enter custom field name:');
    if (fieldName && fieldName.trim()) {
      setEnvironmentConfig(prev => ({
        ...prev,
        customFields: [...prev.customFields, { key: fieldName.trim(), value: '' }]
      }));
    }
  };

  const removeCustomEnvironmentField = (index) => {
    setEnvironmentConfig(prev => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index)
    }));
  };

  const updateCustomEnvironmentField = (index, key, value) => {
    setEnvironmentConfig(prev => ({
      ...prev,
      customFields: prev.customFields.map((field, i) => 
        i === index ? { key, value } : field
      )
    }));
  };

  // Ticket Format Functions
  const saveTicketFormat = () => {
    localStorage.setItem('ticketFormat', JSON.stringify(ticketFormat));
    setShowTicketFormatSettings(false);
    setToast({ message: '✅ Ticket format saved!', type: 'success' });
  };

  const resetTicketFormat = () => {
    setTicketFormat(DEFAULT_TICKET_FIELDS);
    setToast({ message: '🔄 Ticket format reset to default', type: 'info' });
  };

  const toggleFieldEnabled = (fieldId) => {
    setTicketFormat(prev => prev.map(field => 
      field.id === fieldId ? { ...field, enabled: !field.enabled } : field
    ));
  };

  const deleteField = (fieldId) => {
    setTicketFormat(prev => prev.filter(field => field.id !== fieldId));
    setToast({ message: '🗑️ Field removed', type: 'success' });
  };

  const addCustomField = () => {
    const fieldName = prompt('Enter field name:');
    if (fieldName && fieldName.trim()) {
      const newField = {
        id: `custom_${Date.now()}`,
        name: fieldName.trim(),
        enabled: true,
        isDefault: false
      };
      setTicketFormat(prev => [...prev, newField]);
      setToast({ message: `✅ Added "${fieldName.trim()}" field`, type: 'success' });
    }
  };

  const handleFormatDragStart = (e, fieldId) => {
    setDraggedField(fieldId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFormatDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFormatDrop = (e, targetFieldId) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetFieldId) return;

    const draggedIndex = ticketFormat.findIndex(f => f.id === draggedField);
    const targetIndex = ticketFormat.findIndex(f => f.id === targetFieldId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newFormat = [...ticketFormat];
    const [removed] = newFormat.splice(draggedIndex, 1);
    newFormat.splice(targetIndex, 0, removed);

    setTicketFormat(newFormat);
    setDraggedField(null);
  };

  const moveField = (fieldId, direction) => {
    const currentIndex = ticketFormat.findIndex(f => f.id === fieldId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= ticketFormat.length) return;

    const newFormat = [...ticketFormat];
    [newFormat[currentIndex], newFormat[newIndex]] = [newFormat[newIndex], newFormat[currentIndex]];
    setTicketFormat(newFormat);
  };

  // Parse ticket content to extract fields
  const parseTicketForJira = (ticketContent) => {
    const lines = ticketContent.split('\n');
    const fields = {};
    
    // Extract title
    const titleMatch = ticketContent.match(/\*\*Title:\*\*\s*(.+?)(?:\n|$)/);
    fields.title = titleMatch ? titleMatch[1].trim() : 'Bug Report';
    
    // Extract description
    const descMatch = ticketContent.match(/\*\*Description:\*\*\s*\n([\s\S]*?)(?:\n━|$)/);
    fields.description = descMatch ? descMatch[1].trim() : '';
    
    // Extract steps
    const stepsMatch = ticketContent.match(/\*\*Steps to Reproduce:\*\*\s*\n([\s\S]*?)(?:\n━|$)/);
    fields.steps = stepsMatch ? stepsMatch[1].trim() : '';
    
    // Extract expected behavior
    const expectedMatch = ticketContent.match(/\*\*Expected Behaviour:\*\*\s*\n([\s\S]*?)(?:\n━|$)/);
    fields.expected = expectedMatch ? expectedMatch[1].trim() : '';
    
    // Extract actual behavior
    const actualMatch = ticketContent.match(/\*\*Actual Behaviour:\*\*\s*\n([\s\S]*?)(?:\n━|$)/);
    fields.actual = actualMatch ? actualMatch[1].trim() : '';
    
    // Extract impact
    const impactMatch = ticketContent.match(/\*\*Impact:\*\*\s*\n([\s\S]*?)(?:\n━|$)/);
    fields.impact = impactMatch ? impactMatch[1].trim() : '';
    
    // Extract priority - improved regex to handle various formats
    // Try multiple patterns to catch different formats the AI might use
    let priorityText = null;
    
    // Pattern 1: **Priority:** P2 (most common - with bold markdown)
    const priorityMatch1 = ticketContent.match(/\*\*Priority:\*\*\s*([Pp][1-4])\b/);
    if (priorityMatch1 && priorityMatch1[1]) {
      priorityText = priorityMatch1[1].trim().toUpperCase();
      console.log('Priority found via Pattern 1 (bold):', priorityText);
    } else {
      // Pattern 2: Priority: P2 (without bold, with colon)
      const priorityMatch2 = ticketContent.match(/Priority:\s*([Pp][1-4])\b/i);
      if (priorityMatch2 && priorityMatch2[1]) {
        priorityText = priorityMatch2[1].trim().toUpperCase();
        console.log('Priority found via Pattern 2 (colon):', priorityText);
      } else {
        // Pattern 3: Priority P2 (without colon)
        const priorityMatch3 = ticketContent.match(/Priority\s+([Pp][1-4])\b/i);
        if (priorityMatch3 && priorityMatch3[1]) {
          priorityText = priorityMatch3[1].trim().toUpperCase();
          console.log('Priority found via Pattern 3 (space):', priorityText);
        } else {
          // Pattern 4: Just look for P1, P2, P3, P4 anywhere after "Priority" keyword
          const priorityMatch4 = ticketContent.match(/Priority[:\s\*]*\s*([Pp][1-4])\b/i);
          if (priorityMatch4 && priorityMatch4[1]) {
            priorityText = priorityMatch4[1].trim().toUpperCase();
            console.log('Priority found via Pattern 4 (flexible):', priorityText);
          } else {
            // Pattern 5: Look for standalone P1-P4 near "Priority" keyword (within 20 chars)
            const prioritySection = ticketContent.match(/\*\*Priority:\*\*[\s\S]{0,30}/i);
            if (prioritySection) {
              const pMatch = prioritySection[0].match(/([Pp][1-4])\b/);
              if (pMatch && pMatch[1]) {
                priorityText = pMatch[1].trim().toUpperCase();
                console.log('Priority found via Pattern 5 (section search):', priorityText);
              }
            }
          }
        }
      }
    }
    
    // If still not found, default to P3
    if (!priorityText || !/^P[1-4]$/.test(priorityText)) {
      console.warn('⚠️ Priority not found or invalid format. Extracted:', priorityText, '- Defaulting to P3');
      console.warn('Full ticket content for debugging:', ticketContent.substring(0, 500));
      priorityText = 'P3';
    }
    
    // Map P1-P4 to Jira priority IDs (based on standard Jira: 1=Highest, 2=High, 3=Medium, 4=Low, 5=Lowest)
    const priorityIdMap = {
      'P1': '1',  // Highest
      'P2': '2',  // High
      'P3': '3',  // Medium
      'P4': '4'   // Low
    };
    // Store both ID and name for flexibility - always ensure priorityId is set
    fields.priorityId = priorityIdMap[priorityText] || '3'; // Default to '3' (Medium/P3) if mapping fails
    fields.priorityName = priorityText; // Keep original P1-P4 for reference
    
    // Ensure priorityId is always a string (not undefined/null)
    if (!fields.priorityId || typeof fields.priorityId !== 'string') {
      console.error('Priority ID is invalid, forcing to default P3 (ID: 3)');
      fields.priorityId = '3';
      fields.priorityName = 'P3';
    }
    
    // Debug logging
    console.log('=== PRIORITY EXTRACTION DEBUG ===');
    console.log('Raw ticket content (Priority section):', ticketContent.match(/\*\*Priority:\*\*[\s\S]{0,50}/)?.[0]);
    console.log('Extracted priorityText:', priorityText);
    console.log('Mapped priorityId:', fields.priorityId);
    console.log('Mapped priorityName:', fields.priorityName);
    console.log('=== END PRIORITY DEBUG ===');
    
    // Extract environment
    const envMatch = ticketContent.match(/\*\*Environment:\*\*\s*\n([\s\S]*?)(?:\n━|$)/);
    fields.environment = envMatch ? envMatch[1].trim() : '';
    
    return fields;
  };

  // Push ticket to Jira
  const pushToJira = async () => {
    if (!ticket) {
      setToast({ message: '❌ No ticket to push', type: 'error' });
      return;
    }

    // Validate Jira configuration (all fields are now mandatory)
    if (!jiraConfig.url || !jiraConfig.email || !jiraConfig.apiToken || !jiraConfig.projectKey || 
        !jiraConfig.instance || !jiraConfig.productLine || !jiraConfig.component || !jiraConfig.foundVersion || !jiraConfig.engineeringTeam) {
      setToast({ message: '⚙️ Please complete all Jira settings (all fields required)', type: 'error' });
      setShowJiraSettings(true);
      return;
    }

    setIsPushingToJira(true);
    setJiraPushStep('Preparing ticket data...');

    try {
      // Parse ticket content
      const fields = parseTicketForJira(ticket);
      
      // Debug: Log priority extraction
      console.log('=== PRIORITY DEBUG ===');
      console.log('Priority ID:', fields.priorityId);
      console.log('Priority Name:', fields.priorityName);
      console.log('Full fields object:', JSON.stringify(fields, null, 2));
      console.log('=== END DEBUG ===');
      
      setJiraPushStep('Validating Jira connection...');
      
      // Use backend proxy to avoid CORS issues
      const JIRA_ENDPOINT = getApiEndpoint('push-to-jira');

      // Prepare request payload
      const requestPayload = {
        jiraUrl: jiraConfig.url,
        email: jiraConfig.email,
        apiToken: jiraConfig.apiToken,
        projectKey: jiraConfig.projectKey,
        fields: fields,
        customFields: {
          instance: jiraConfig.instance,
          productLine: jiraConfig.productLine,
          component: jiraConfig.component,
          foundVersion: jiraConfig.foundVersion,
          engineeringTeam: jiraConfig.engineeringTeam
        }
      };
      
      // Calculate attachment payload size (to avoid Netlify limits)
      // Base64 encoding increases size by ~33%, so we need to account for that in JSON
      const estimatePayloadSize = (base64String) => {
        // Base64 string length in JSON (with quotes and escaping) is roughly the string length
        // Plus JSON overhead, estimate as 1.1x the base64 string length
        return Math.ceil(base64String.length * 1.1);
      };
      
      let totalAttachmentBytes = 0;
      if (files.length > 0) {
        totalAttachmentBytes = files.reduce((sum, fileItem) => {
          // Get base64 data (after the data:image/...;base64, prefix)
          const base64Data = fileItem.preview.includes(',') 
            ? fileItem.preview.split(',')[1] 
            : fileItem.preview;
          return sum + estimatePayloadSize(base64Data);
        }, 0);
        
        // Add JSON structure overhead for attachments array (~200 bytes per file)
        totalAttachmentBytes += files.length * 200;
      }

      // Netlify functions typically have a body limit (~6–10 MB). Use a conservative 6 MB cap for attachments only.
      // The rest of the payload (fields, customFields, etc.) adds ~50KB, so we leave room for that.
      const NETLIFY_ATTACHMENT_LIMIT_BYTES = 6 * 1024 * 1024; // 6 MB for attachments
      const shouldSkipAttachments =
        import.meta.env.PROD &&
        totalAttachmentBytes > NETLIFY_ATTACHMENT_LIMIT_BYTES;

      // Debug logging
      console.log('=== ATTACHMENT SIZE CHECK ===');
      console.log('Files count:', files.length);
      console.log('Total attachment payload size (estimated):', (totalAttachmentBytes / 1024 / 1024).toFixed(2), 'MB');
      console.log('Limit:', (NETLIFY_ATTACHMENT_LIMIT_BYTES / 1024 / 1024).toFixed(2), 'MB');
      console.log('Should skip attachments:', shouldSkipAttachments);
      console.log('Is production:', import.meta.env.PROD);
      console.log('=== END ATTACHMENT CHECK ===');

      if (shouldSkipAttachments) {
        setToast({
          message:
            'ℹ️ Attachments are large; pushing ticket without attachments to avoid Netlify size limits. You can add them manually in Jira.',
          type: 'info'
        });
      }

      // Additional debug: Log the exact payload being sent
      console.log('=== PAYLOAD BEING SENT TO BACKEND ===');
      console.log('Priority in fields:', {
        priorityId: fields.priorityId,
        priorityName: fields.priorityName
      });
      console.log('Full fields object:', JSON.stringify(fields, null, 2));
      console.log('=== END PAYLOAD DEBUG ===');

      // Include files if uploaded (max 10)
      if (files.length > 0 && !shouldSkipAttachments) {
        setJiraPushStep(`Preparing ${files.length} attachment(s)...`);
        requestPayload.attachments = files.map(fileItem => ({
          filename: fileItem.name,
          contentType: fileItem.type,
          data: fileItem.preview // base64 encoded file
        }));
      }

      setJiraPushStep('Creating Jira ticket...');
      
      // Make API call through backend proxy with timeout
      const response = await fetchWithTimeout(JIRA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      }, 120000); // 120 second timeout for Jira (includes attachments)

      if (!response.ok) {
        let errorMessage = 'Failed to create Jira ticket';
        
        // Handle specific error codes with user-friendly messages
        if (response.status === 413) {
          errorMessage = `📦 One or more files you uploaded are too large for Jira. Please remove large files (click Clear All or individual X buttons) and then push the ticket again.`;
          throw new Error(errorMessage);
        } else if (response.status === 401) {
          errorMessage = '🔐 Authentication failed. Please check your Jira Email and API Token in settings.';
          throw new Error(errorMessage);
        } else if (response.status === 403) {
          errorMessage = '🚫 Permission denied. Your Jira account may not have permission to create tickets in this project.';
          throw new Error(errorMessage);
        } else if (response.status === 404) {
          errorMessage = '🔍 Project not found. Please verify your Jira URL and Project Key in settings.';
          throw new Error(errorMessage);
        }
        
        try {
          const errorData = await response.json();
          console.error('Jira API Error:', errorData);
          
          // Extract error message from various possible formats
          if (typeof errorData.error === 'string') {
            errorMessage = `❌ ${errorData.error}`;
          } else if (errorData.error && typeof errorData.error === 'object') {
            errorMessage = `❌ ${JSON.stringify(errorData.error)}`;
          } else if (errorData.errorMessages && Array.isArray(errorData.errorMessages)) {
            errorMessage = `❌ ${errorData.errorMessages.join(', ')}`;
          } else if (errorData.details) {
            errorMessage = `❌ ${JSON.stringify(errorData.details)}`;
          }
        } catch (e) {
          // Network or parsing error
          if (response.status === 0) {
            errorMessage = '🌐 Network error. Please check your internet connection and try again.';
          } else {
            errorMessage = `⚠️ Server error (${response.status}). Please try again later.`;
          }
        }
        throw new Error(errorMessage);
      }

      setJiraPushStep(files.length > 0 ? `Uploading ${files.length} attachment(s)...` : 'Finalizing ticket...');
      
      const data = await response.json();
      const jiraKey = data.key;
      const jiraLink = data.url;

      setToast({ 
        message: `✅ Jira ticket ${jiraKey} created successfully!`, 
        type: 'success' 
      });

      // Open Jira ticket in new tab
      setTimeout(() => {
        window.open(jiraLink, '_blank');
      }, 500);

    } catch (error) {
      console.error('Jira push error:', error);
      
      // Better error message handling
      let displayMessage = error.message || '❌ An unexpected error occurred. Please try again.';
      
      // Truncate if too long
      if (displayMessage.length > 200) {
        displayMessage = displayMessage.substring(0, 200) + '...';
      }
      
      setToast({ 
        message: displayMessage, 
        type: 'error' 
      });
    } finally {
      setIsPushingToJira(false);
      setJiraPushStep('');
    }
  };

  // Voice Input Handler
  const toggleVoiceInput = async () => {
    if (!recognitionRef.current) {
      setToast({ message: '❌ Voice input not supported in this browser', type: 'error' });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setToast({ message: '🎤 Voice input stopped', type: 'success' });
    } else {
      try {
        // Request microphone permission first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Permission granted, stop the stream (we just needed permission)
          stream.getTracks().forEach(track => track.stop());
        } catch (permissionError) {
          if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
            setToast({ 
              message: '🎤 Microphone permission denied. Please click the microphone icon in your browser\'s address bar and allow access, then try again.', 
              type: 'error' 
            });
            return;
          } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
            setToast({ 
              message: '🎤 No microphone found. Please connect a microphone and try again.', 
              type: 'error' 
            });
            return;
          } else {
            console.warn('Microphone permission error:', permissionError);
            // Continue anyway - some browsers might still work
          }
        }

        // Start voice recognition
        recognitionRef.current.start();
        setIsListening(true);
        setToast({ message: '🎤 Listening... Speak now', type: 'success' });
      } catch (error) {
        setIsListening(false);
        if (error.name === 'NotAllowedError' || error.message.includes('not-allowed')) {
          setToast({ 
            message: '🎤 Microphone permission denied. Please allow microphone access in your browser settings and try again.', 
            type: 'error' 
          });
        } else {
          setToast({ 
            message: `❌ Failed to start voice input: ${error.message || error}`, 
            type: 'error' 
          });
        }
      }
    }
  };

  // AI Description Enhancer
  const enhanceDescription = async () => {
    if (!bugDescription.trim()) {
      setToast({ message: '❌ Please enter a description first', type: 'error' });
      return;
    }

    if (bugDescription.split(/\s+/).length > 20) {
      setToast({ message: '💡 Your description is already detailed', type: 'success' });
      return;
    }

    setIsEnhancing(true);
    try {
      // Get API endpoint at runtime to ensure correct platform detection
      const API_ENDPOINT = getApiEndpoint('generate-ticket');
      const response = await fetchWithTimeout(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: `Expand this short bug description into a more detailed technical description (2-3 sentences). Keep it professional and bug-focused. IMPORTANT: Your response MUST be in English language only, regardless of the input language. Original description: "${bugDescription}"`
            }]
          }]
        })
      }, 30000); // 30 second timeout for description enhancement

      if (!response.ok) throw new Error('Failed to enhance description');

      const data = await response.json();
      const enhanced = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n')
        .trim();

      setBugDescription(enhanced);
      setToast({ message: '✨ Description enhanced!', type: 'success' });
    } catch (error) {
      setToast({ message: '❌ Failed to enhance description', type: 'error' });
    } finally {
      setIsEnhancing(false);
    }
  };

  // Save Ticket to History
  const saveTicketToHistory = (ticketContent) => {
    const newTicket = {
      id: Date.now(),
      content: ticketContent,
      description: bugDescription.substring(0, 100),
      timestamp: new Date().toISOString(),
      hasMedia: files.length > 0
    };

    const updatedHistory = [newTicket, ...ticketHistory].slice(0, 10); // Keep last 10
    setTicketHistory(updatedHistory);
    localStorage.setItem('ticketHistory', JSON.stringify(updatedHistory));
  };

  // Delete History Item
  const deleteHistoryItem = (id) => {
    const updatedHistory = ticketHistory.filter(t => t.id !== id);
    setTicketHistory(updatedHistory);
    localStorage.setItem('ticketHistory', JSON.stringify(updatedHistory));
    setToast({ message: '🗑️ Ticket removed from history', type: 'success' });
  };

  // Load ticket from history
  const loadHistoryTicket = (historyItem) => {
    setTicket(historyItem.content);
    setShowHistory(false);
    setToast({ message: '📂 Ticket loaded from history', type: 'success' });
  };

  const extractMultipleVideoFrames = async (videoFile, numFrames = 3) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const videoURL = URL.createObjectURL(videoFile);
      video.src = videoURL;
      
      const frames = [];
      let currentFrameIndex = 0;
      const framePositions = [0.1, 0.5, 0.9]; // Extract frames at 10%, 50%, and 90% of video
      
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = video.duration * framePositions[0];
      });
      
      video.addEventListener('seeked', () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              frames.push(base64);
              
              currentFrameIndex++;
              if (currentFrameIndex < Math.min(numFrames, framePositions.length)) {
                video.currentTime = video.duration * framePositions[currentFrameIndex];
              } else {
                URL.revokeObjectURL(videoURL);
                resolve(frames);
              }
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.85);
      });
      
      video.addEventListener('error', () => {
        URL.revokeObjectURL(videoURL);
        reject(new Error('Failed to load video'));
      });
    });
  };

  // Helper function to add timeout to fetch requests
  const fetchWithTimeout = async (url, options = {}, timeout = 60000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('⏱️ Request timeout. The server is taking too long to respond. Please try again.');
      }
      throw error;
    }
  };

  const generateTicket = async () => {
    if (!bugDescription.trim()) {
      setToast({ message: '❌ Please provide a bug description', type: 'error' });
      return;
    }

    // Validate that description contains actual words, not just punctuation/special characters
    const hasActualWords = /[a-zA-Z]{2,}/.test(bugDescription);
    if (!hasActualWords) {
      setToast({ message: '❌ Please use actual words, not just punctuation or special characters', type: 'error' });
      return;
    }

    // Count actual words (at least 2 characters long)
    const words = bugDescription.match(/[a-zA-Z]{2,}/g) || [];
    if (words.length < 5) {
      setToast({ message: `❌ Please add ${5 - words.length} more word${5 - words.length !== 1 ? 's' : ''} (${words.length}/5)`, type: 'error' });
      return;
    }

    // Check if description contains bug/technical-related keywords
    const technicalKeywords = [
      'bug', 'error', 'issue', 'problem', 'broken', 'not working', 'fails', 'crash',
      'button', 'page', 'form', 'menu', 'dropdown', 'field', 'input', 'click',
      'load', 'display', 'show', 'appear', 'missing', 'wrong', 'incorrect',
      'unable', 'cannot', 'does not', 'doesn\'t', 'didn\'t', 'should', 'expected',
      'freeze', 'hang', 'slow', 'timeout', 'redirect', 'login', 'logout', 'submit',
      'upload', 'download', 'save', 'delete', 'update', 'create', 'edit',
      'screen', 'modal', 'popup', 'dialog', 'alert', 'message', 'notification',
      'api', 'request', 'response', 'data', 'database', 'server', 'client'
    ];
    
    const descriptionLower = bugDescription.toLowerCase();
    const hasTechnicalContext = technicalKeywords.some(keyword => 
      descriptionLower.includes(keyword)
    );
    
    if (!hasTechnicalContext) {
      setToast({ message: '❌ Please describe a technical bug/issue. Use keywords like "error", "broken", "not working", etc.', type: 'error' });
      return;
    }

    setLoading(true);
    setError('');
    setTicket(null);
    setLoadingStep('🚀 Getting ready to help you...');
    setLoadingProgress(0);
    
    // Clear any existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    // Set countdown to 20 seconds for all cases
    setCountdown(20);

    // Start countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 0; // Stay at 0, don't clear interval yet
        }
        return prev - 1;
      });
    }, 1000);

    try {
      // AI-like conversational loading steps
      setLoadingStep('👋 Hello! I\'m analyzing your bug report...');
      setLoadingProgress(10);
      
      const messages = [
        {
          role: 'user',
          content: []
        }
      ];

      // Count images and videos
      const imageCount = files.filter(f => f.type.startsWith('image/')).length;
      const videoCount = files.filter(f => f.type.startsWith('video/')).length;

      // Add multiple images/videos if uploaded
      if (files.length > 0) {
        setLoadingStep(`📎 Examining your ${files.length} file(s) in detail...`);
        setLoadingProgress(25);

        // Add header text about files
        let filesText = '';
        if (imageCount > 0 && videoCount > 0) {
          filesText = `[${imageCount} image(s) and ${videoCount} video(s) provided showing the bug]`;
        } else if (imageCount > 0) {
          filesText = `[${imageCount} image(s) provided showing the bug]`;
        } else {
          filesText = `[${videoCount} video(s) provided showing the bug]`;
        }
        messages[0].content.push({
          type: 'text',
          text: filesText
        });

        // Process each file
        for (let i = 0; i < files.length; i++) {
          const fileItem = files[i];
          
          if (fileItem.type.startsWith('image/')) {
            // Process image
            const base64Data = fileItem.preview.split(',')[1] || fileItem.preview;
            messages[0].content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: fileItem.type,
                data: base64Data
              }
            });
          } else if (fileItem.type.startsWith('video/')) {
            // Extract frames from video
            try {
              setLoadingStep(`🎬 Analyzing video ${i + 1} of ${videoCount}...`);
              const videoFrames = await extractMultipleVideoFrames(fileItem.file, 3);
              
              // Add frames
              videoFrames.forEach((frameData) => {
                messages[0].content.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: frameData
                  }
                });
              });
            } catch (videoError) {
              console.error(`Error extracting frames from video ${i + 1}:`, videoError);
              // Fallback: keep the video reference for Jira attachment and inform the AI
              messages[0].content.push({
                type: 'text',
                text: `[Video "${fileItem.name}" attached; frame extraction skipped due to size/format. Please use the video attachment for context.]`
              });
              setToast({ 
                message: `ℹ️ Video "${fileItem.name}" kept as attachment; frame extraction skipped.`, 
                type: 'info' 
              });
            }
          }
        }
        
        setLoadingProgress(45);
      }

      // Add bug description
      messages[0].content.push({
        type: 'text',
        text: `Please analyze this bug report and create a detailed bug ticket.

User's Brief Description: ${bugDescription}

${files.length > 0 ? `${imageCount} image(s) and ${videoCount} video(s) have been provided showing the bug. Please carefully analyze all media to understand the issue and incorporate your observations into the Description, Steps to Reproduce, Expected Behaviour, and Actual Behaviour sections.` : 'No media files were provided.'}

CRITICAL - LANGUAGE REQUIREMENT:
- The user's description may be in ANY language (English, Spanish, French, Hindi, Chinese, etc.)
- You MUST create the entire bug ticket in ENGLISH language ONLY
- Translate the user's input to English if needed
- All sections (Title, Description, Steps, etc.) must be in English

IMPORTANT: 
- If images or video frames are provided, analyze them carefully and use what you see to write detailed Description, Steps to Reproduce, Expected Behaviour, and Actual Behaviour sections.
- DO NOT write a separate visual description in the Attachment field.
- The Attachment field should ONLY contain the filename, nothing else.

Please create a CONCISE and TO-THE-POINT bug ticket following this EXACT format with BOLD headings. Keep all sections SHORT and focused - no long paragraphs:

${(() => {
  const enabledFields = ticketFormat.filter(f => f.enabled);
  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  let formatString = '';
  
  enabledFields.forEach((field, index) => {
    const fieldName = field.name;
    
    // Generate field-specific content based on field ID
    if (field.id === 'title') {
      formatString += `**${fieldName}:** [Create a clear, concise title - max 15 words]\n\n${separator}\n\n`;
    } else if (field.id === 'description') {
      formatString += `**${fieldName}:** \n[Write 2-3 SHORT sentences maximum. Be direct and to-the-point. Include key visual details if media is provided.]\n\n${separator}\n\n`;
    } else if (field.id === 'steps') {
      formatString += `**${fieldName}:**\n1. [SHORT, clear first step]\n2. [SHORT second step]\n3. [SHORT third step - keep steps brief, 1 line each max]\n\n${separator}\n\n`;
    } else if (field.id === 'expected') {
      formatString += `**${fieldName}:** \n[ONE sentence describing normal behavior]\n\n${separator}\n\n`;
    } else if (field.id === 'actual') {
      formatString += `**${fieldName}:** \n[ONE sentence describing the bug]\n\n${separator}\n\n`;
    } else if (field.id === 'impact') {
      formatString += `**${fieldName}:** \n[ONE sentence - state impact level (Critical/High/Medium/Low) and brief reason]\n\n${separator}\n\n`;
    } else if (field.id === 'priority') {
      formatString += `**${fieldName}:** [Just state: P1, P2, P3, or P4 - nothing else]\n\n${separator}\n\n`;
    } else if (field.id === 'environment') {
      // Use saved environment configuration
      const envConfig = loadEnvironmentConfig();
      let envString = `**${fieldName}:**\n`;
      
      // Instance
      envString += `Instance: ${envConfig.instance || 'https://workspan-staging-2.qa.workspan.app/'}\n`;
      
      // Branch
      envString += `Branch: ${envConfig.branch || '[Suggest likely branch or write "To be determined"]'}\n`;
      
      // Username
      envString += `Username: ${envConfig.username || '[Leave blank or write "To be provided"]'}\n`;
      
      // Password
      envString += `Password: ${envConfig.password || '[Leave blank or write "To be provided"]'}\n`;
      
      // Custom fields
      if (envConfig.customFields && envConfig.customFields.length > 0) {
        envConfig.customFields.forEach(customField => {
          if (customField.key && customField.value) {
            envString += `${customField.key}: ${customField.value}\n`;
          }
        });
      }
      
      formatString += envString + `\n${separator}\n\n`;
    } else if (field.id === 'attachment') {
      formatString += `**${fieldName}:** ${files.length > 0 ? files.map(f => f.name).join(', ') : 'No attachments provided'}\n\n`;
    } else {
      // Custom field
      formatString += `**${fieldName}:** \n[Provide relevant information for this field]\n\n${index < enabledFields.length - 1 ? separator + '\n\n' : ''}`;
    }
  });
  
  return formatString;
})()}

CRITICAL FORMATTING RULES:
1. Use **bold** for all field labels
2. Add the horizontal line separator (━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━) after EACH section - use EXACTLY 50 unicode box characters
3. The Attachment field must ONLY contain the filename - DO NOT add any description or analysis text there
4. Incorporate all visual observations into Description, Steps to Reproduce, Expected Behaviour, and Actual Behaviour sections
5. Follow this EXACT format and field order - ONLY include these fields in this exact order: ${ticketFormat.filter(f => f.enabled).map(f => f.name).join(', ')}
6. Do not add any additional sections or fields not listed above
7. Keep all horizontal lines exactly the same length (50 characters)
8. IMPORTANT: Keep everything SHORT and CONCISE - use 1-2 sentences per section, brief steps, no long paragraphs
9. Be direct and to-the-point - quality over quantity`
      });

      setLoadingStep('🧠 Using AI to understand the issue deeply...');
      setLoadingProgress(60);
      
      // Get API endpoint at runtime (not module load time) to ensure correct detection
      let API_ENDPOINT = getApiEndpoint('generate-ticket');
      
      // Force Vercel endpoint if we're on a Vercel domain (safety check)
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname.toLowerCase();
        if (hostname.includes('vercel') && !API_ENDPOINT.startsWith('/api/')) {
          console.warn('⚠️ Forcing Vercel endpoint - detection may have failed');
          API_ENDPOINT = `/api/generate-ticket`;
        }
      }
      
      // Debug: Log the endpoint being used
      console.log('🔍 Calling API endpoint:', API_ENDPOINT);
      console.log('🔍 Current hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
      console.log('🔍 Full URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
      console.log('🔍 Is Production:', import.meta.env.PROD);
      
      const response = await fetchWithTimeout(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages
        })
      }, 90000); // 90 second timeout for AI generation

      // Check content type before parsing
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        let errorMessage = 'Failed to generate ticket';
        
        if (isJson) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `Server error (${response.status}). Please check your API endpoint configuration.`;
          }
        } else {
          // Not JSON - likely HTML error page (404, 500, etc.)
          const textResponse = await response.text();
          console.error('Non-JSON error response:', textResponse.substring(0, 200));
          
          if (response.status === 404) {
            errorMessage = `❌ API endpoint not found (404). The endpoint "${API_ENDPOINT}" may be incorrect. Please check your deployment configuration.`;
          } else if (response.status === 500) {
            errorMessage = '❌ Server error (500). Please check your API key and server configuration.';
          } else {
            errorMessage = `❌ Server returned non-JSON response (${response.status}). Please check your API endpoint.`;
          }
        }
        
        throw new Error(errorMessage);
      }

      setLoadingStep('✍️ Crafting a professional ticket for you...');
      setLoadingProgress(80);
      
      // Parse response with error handling
      let data;
      if (isJson) {
        data = await response.json();
      } else {
        const textResponse = await response.text();
        console.error('Expected JSON but got:', textResponse.substring(0, 200));
        throw new Error(`❌ Server returned non-JSON response. Endpoint: ${API_ENDPOINT}. Please check your deployment configuration.`);
      }
      const ticketContent = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
      
      setLoadingStep('✨ Adding final touches and formatting...');
      setLoadingProgress(95);
      
      // Calculate quality score
      const score = calculateQualityScore(ticketContent);
      setQualityScore(score);

      // Clear countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      setLoadingProgress(100);
      setTicket(ticketContent);
      setOriginalTicket(ticketContent); // Store original for reset functionality
      setEditedTicket(ticketContent); // Initialize edited ticket
      setIsEditingTicket(false); // Reset edit mode
      setCountdown(0);
      setShowConfetti(true);
      setToast({ message: '🎉 Ticket generated successfully!', type: 'success' });
      
      // Save to history
      saveTicketToHistory(ticketContent);
      
      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 4000);
    } catch (err) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setToast({ message: `❌ ${err.message || 'Failed to generate ticket. Please try again.'}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBugDescription('');
    setFiles([]);
    setTicket(null);
    setOriginalTicket(null);
    setEditedTicket('');
    setIsEditingTicket(false);
    setShowSaveDialog(false);
    setError('');
    setWordCount(0);
    setCharCount(0);
    setQualityScore(null);
    // Reset file input
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
    setToast({ message: '✨ Form reset!', type: 'info' });
  };

  // Edit ticket functions
  const handleEditTicket = () => {
    setIsEditingTicket(true);
    setEditedTicket(ticket);
  };

  const handleCancelEdit = () => {
    setIsEditingTicket(false);
    setEditedTicket(ticket); // Reset to current ticket
    setShowSaveDialog(false);
  };

  const handleSaveTicketClick = () => {
    setShowSaveDialog(true);
  };

  const handleFinallySave = () => {
    setTicket(editedTicket);
    setOriginalTicket(editedTicket); // Update original as well
    setIsEditingTicket(false);
    setShowSaveDialog(false);
    setToast({ message: '✅ Ticket edited and saved successfully!', type: 'success' });
  };

  const handleResetToOriginal = () => {
    if (originalTicket) {
      setTicket(originalTicket);
      setEditedTicket(originalTicket);
      setIsEditingTicket(false);
      setShowSaveDialog(false);
      setToast({ message: '🔄 Ticket reset to original AI-generated version', type: 'info' });
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(ticket);
    setCopied(true);
    setToast({ message: '📋 Copied to clipboard!', type: 'success' });
    // Reset copied state after 2 seconds
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleDownloadTicket = () => {
    const blob = new Blob([ticket], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug-ticket-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast({ message: '💾 Ticket downloaded!', type: 'success' });
  };

  const estimatedReadTime = Math.ceil(wordCount / 200); // Average reading speed

  // Calculate ticket quality score
  const calculateQualityScore = (ticketText) => {
    let score = 0;
    let maxScore = 100;
    let feedback = [];

    // Check for essential sections (40 points)
    if (ticketText.includes('**Title:**')) score += 8;
    if (ticketText.includes('**Description:**')) score += 8;
    if (ticketText.includes('**Steps to Reproduce:**')) score += 8;
    if (ticketText.includes('**Expected Behaviour:**')) score += 8;
    if (ticketText.includes('**Actual Behaviour:**')) score += 8;

    // Check for detailed steps (20 points)
    const stepsMatch = ticketText.match(/\d+\./g);
    if (stepsMatch && stepsMatch.length >= 3) {
      score += 20;
    } else if (stepsMatch) {
      score += stepsMatch.length * 5;
      feedback.push('Add more detailed steps');
    } else {
      feedback.push('Missing reproduction steps');
    }

    // Check for priority (10 points)
    if (ticketText.includes('**Priority:**')) {
      score += 10;
    }

    // Check for environment details (10 points)
    if (ticketText.includes('**Environment:**')) {
      score += 10;
    }

    // Check for adequate description length (20 points)
    const descMatch = ticketText.match(/\*\*Description:\*\*([\s\S]*?)\*\*/);
    if (descMatch && descMatch[1].length > 100) {
      score += 20;
    } else if (descMatch && descMatch[1].length > 50) {
      score += 10;
      feedback.push('Description could be more detailed');
    } else {
      feedback.push('Description is too brief');
    }

    // Determine rating
    let rating = 'Fair';
    let color = 'yellow';
    if (score >= 90) {
      rating = 'Excellent';
      color = 'green';
    } else if (score >= 75) {
      rating = 'Very Good';
      color = 'blue';
    } else if (score >= 60) {
      rating = 'Good';
      color = 'teal';
    } else if (score >= 40) {
      rating = 'Fair';
      color = 'yellow';
    } else {
      rating = 'Needs Improvement';
      color = 'red';
    }

    return { score, rating, color, feedback };
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'gradient-animated'} p-4 md:p-8 transition-colors duration-500`}>
      {/* Confetti Effect */}
      <Confetti show={showConfetti} />
      
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* History Sidebar Button */}
      <div className="fixed top-6 left-6 z-40 group">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl hover:scale-105 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-indigo-500/30' 
              : 'bg-gradient-to-br from-white to-gray-50 border-2 border-indigo-200'
          }`}
        >
          <History className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
            History {ticketHistory.length > 0 && `(${ticketHistory.length})`}
          </span>
        </button>
        
        {/* Tooltip */}
        <div className={`absolute top-full left-0 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
          isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-white'
        }`}>
          View ticket history
          <div className={`absolute -top-1 left-4 w-2 h-2 rotate-45 ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
          }`}></div>
        </div>
      </div>
      
      {/* Top Right Controls - Compact & Modern */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-40 flex items-center gap-2 md:gap-3">
        {/* Jira Settings Button */}
        <div className="group relative">
          <button
            onClick={() => setShowJiraSettings(true)}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 ${
              isDarkMode 
                ? 'bg-gray-800/80 hover:bg-gray-700 border border-gray-700' 
                : 'bg-white/80 hover:bg-gray-50 border border-gray-200 shadow-sm'
            } backdrop-blur-sm hover:scale-105`}
          >
            <Settings className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </button>
          {/* Instant Tooltip */}
          <div className={`absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none transition-all duration-75 ${
            isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-white'
          } opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0`}>
            Configure Jira
            <div className={`absolute -top-1 right-3 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
            }`}></div>
          </div>
        </div>

        {/* Ticket Format Settings Button */}
        <div className="group relative">
          <button
            onClick={() => setShowTicketFormatSettings(true)}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 ${
              isDarkMode 
                ? 'bg-gray-800/80 hover:bg-gray-700 border border-gray-700' 
                : 'bg-white/80 hover:bg-gray-50 border border-gray-200 shadow-sm'
            } backdrop-blur-sm hover:scale-105`}
          >
            <FileText className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          </button>
          {/* Instant Tooltip */}
          <div className={`absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none transition-all duration-75 ${
            isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-white'
          } opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0`}>
            Customize Ticket Format
            <div className={`absolute -top-1 right-3 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
            }`}></div>
          </div>
        </div>
        
        {/* Dark Mode Toggle - Modern Switch Style */}
        <div className="group relative">
          <button
            onClick={() => {
              const newDarkMode = !isDarkMode;
              setIsDarkMode(newDarkMode);
              localStorage.setItem('darkMode', newDarkMode.toString());
            }}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl transition-all duration-200 ${
              isDarkMode 
                ? 'bg-gray-800/80 hover:bg-gray-700 border border-gray-700' 
                : 'bg-white/80 hover:bg-gray-50 border border-gray-200 shadow-sm'
            } backdrop-blur-sm hover:scale-105`}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600" />
            )}
          </button>
          {/* Instant Tooltip */}
          <div className={`absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none transition-all duration-75 ${
            isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-white'
          } opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0`}>
            {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            <div className={`absolute -top-1 right-3 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
            }`}></div>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 animate-fadeIn">
          <div className="inline-block mb-4">
            <h1 className={`text-5xl md:text-6xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r ${
              isDarkMode 
                ? 'from-blue-400 via-purple-400 to-indigo-400' 
                : 'from-blue-600 via-purple-600 to-indigo-600'
            } animate-gradient`}>
              AI Bug Ticket Generator
            </h1>
            <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-full mx-auto w-3/4 animate-shimmer"></div>
          </div>
          <p className={`text-xl font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Upload a bug screenshot/video and get a detailed ticket instantly
          </p>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${
            isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'
          } backdrop-blur-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-lg`}>
            <span className="text-2xl">💡</span>
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Quick tips:
            </span>
            <kbd className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-md ${
              isDarkMode ? 'bg-gray-700 text-gray-200 border border-gray-600' : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              Ctrl+Enter
            </kbd>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>to generate</span>
            <span className={`text-gray-400 ${isDarkMode ? 'text-gray-600' : ''}`}>•</span>
            <kbd className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-md ${
              isDarkMode ? 'bg-gray-700 text-gray-200 border border-gray-600' : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              ESC
            </kbd>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>to clear</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className={`${isDarkMode ? 'bg-gray-800/90' : 'bg-white/90'} backdrop-blur-sm rounded-xl shadow-lg p-6 animate-slideInLeft card-float`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} flex items-center gap-2`}>
                <span className="text-3xl">🐛</span>
                Report Bug
              </h2>
            </div>
            
            {/* Bug Description */}
            <div className="mb-4">
              {/* Quick Action Buttons */}
              <div className="flex items-center justify-between mb-3 gap-2">
                <label className={`text-base font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                  <span className="text-lg">✍️</span>
                  Brief Bug Description
                </label>
                
                <div className="flex gap-2">
                  {/* Voice Input Button with Instant Tooltip */}
                  <div className="relative group">
                    <button
                      onClick={toggleVoiceInput}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm hover:scale-105 ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : isDarkMode 
                          ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-700' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                      }`}
                    >
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      {isListening ? 'Stop' : 'Voice'}
                      {!isListening && <span className="text-[10px] opacity-70">🌍</span>}
                    </button>
                    
                    {/* Instant Tooltip */}
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-50 ${
                      isDarkMode 
                        ? 'bg-gray-700 text-gray-200' 
                        : 'bg-gray-800 text-white'
                    }`}>
                      {isListening ? 'Stop voice input' : 'Start voice input (Supports all languages)'}
                      <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
                      }`}></div>
                    </div>
                  </div>
                  
                  {/* AI Enhance Button with Instant Tooltip */}
                  <div className="relative group">
                    <button
                      onClick={enhanceDescription}
                      disabled={isEnhancing || !bugDescription.trim()}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDarkMode 
                          ? 'bg-gradient-to-r from-pink-900/30 to-purple-900/30 text-pink-300 hover:from-pink-900/50 hover:to-purple-900/50 border border-pink-700' 
                          : 'bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700 hover:from-pink-200 hover:to-purple-200 border border-pink-300'
                      }`}
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Enhance
                    </button>
                    
                    {/* Instant Tooltip */}
                    {!isEnhancing && bugDescription.trim() && (
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-50 ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-200' 
                          : 'bg-gray-800 text-white'
                      }`}>
                        Enhance with AI (Outputs in English)
                        <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-800'
                        }`}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <textarea
                ref={textareaRef}
                value={bugDescription}
                onChange={handleDescriptionChange}
                placeholder="Example: The login button on the homepage doesn't respond when clicked on mobile devices... (Type or speak in any language 🌍)"
                rows="5"
                className={`w-full px-5 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base leading-relaxed ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:bg-gray-700' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 hover:border-gray-400'
                }`}
              />
              
              {/* Multi-language Info */}
              <div className={`mt-2 flex items-center gap-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="text-sm">🌍</span>
                <span>Voice input supports all languages. Ticket will be generated in English.</span>
              </div>
              
              {/* Ultra Enhanced Word Count Indicator with Progress Bar */}
              <div className="mt-4 space-y-3">
                {/* Enhanced Progress Bar with Glow */}
                <div className="relative">
                  <div className={`h-3 rounded-full overflow-hidden ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <div 
                      className={`h-full transition-all duration-500 ease-out relative ${
                        wordCount >= 10 
                          ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600' 
                          : wordCount >= 5 
                          ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500' 
                          : 'bg-gradient-to-r from-red-400 via-pink-500 to-red-500'
                      }`}
                      style={{ 
                        width: `${Math.min((wordCount / 5) * 100, 100)}%`,
                        boxShadow: wordCount >= 10 
                          ? '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)' 
                          : wordCount >= 5
                          ? '0 0 15px rgba(251, 146, 60, 0.4)'
                          : '0 0 10px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                    </div>
                  </div>
                  
                  {/* Animated Percentage Badge */}
                  <div 
                    className={`absolute -top-1 transition-all duration-500 ease-out ${
                      wordCount >= 5 ? 'animate-bounce' : ''
                    }`}
                    style={{ 
                      left: `${Math.min((wordCount / 5) * 100, 100)}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <span className={`inline-flex items-center justify-center px-3 py-1 text-sm font-extrabold rounded-full shadow-xl border-2 ${
                      wordCount >= 5 
                        ? 'bg-green-500 text-white ring-4 ring-green-200 border-white animate-bounce' 
                        : wordCount >= 3 
                        ? 'bg-yellow-500 text-white border-white' 
                        : 'bg-red-500 text-white border-white'
                    }`}>
                      {wordCount >= 5 ? '✓' : wordCount}
                    </span>
                  </div>
                </div>
                
                {/* Message and Counter */}
                <div className="flex items-center justify-between">
                <div className={`text-sm font-medium transition-all duration-300 ${
                    wordCount >= 5 
                      ? 'text-green-600' 
                      : wordCount >= 3 
                      ? 'text-yellow-600' 
                      : 'text-red-500'
                  }`}>
                  {wordCount < 5 ? (
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          wordCount >= 3 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          wordCount >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></span>
                      </span>
                      <span className={wordCount === 0 ? 'animate-pulse' : ''}>
                        {wordCount === 0 
                          ? 'Start typing to see progress...'
                          : `Add ${5 - wordCount} more word${5 - wordCount !== 1 ? 's' : ''} for ticket`
                        }
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      <span className="font-semibold animate-pulse">
                        🎉 Perfect! Ready to generate ticket
                      </span>
                    </span>
                  )}
                </div>
                  
                  {/* Enhanced Counter Badge */}
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-extrabold px-4 py-2 rounded-xl transition-all duration-300 shadow-lg border-2 ${
                      wordCount >= 5 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-300 ring-4 ring-green-200 animate-pulse' 
                        : wordCount >= 3 
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-300' 
                        : 'bg-gradient-to-r from-red-400 to-pink-500 text-white border-red-300'
                    }`}>
                      {wordCount}/5 words
                    </span>
                    {wordCount >= 5 && (
                      <span className="text-3xl animate-bounce">✨</span>
                    )}
                  </div>
                </div>
                
                {/* Milestone Messages */}
                {wordCount === 3 && (
                  <div className={`text-xs font-medium px-3 py-2 rounded-lg border animate-slideInUp ${
                    isDarkMode 
                      ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700' 
                      : 'text-yellow-600 bg-yellow-50 border-yellow-200'
                  }`}>
                    💪 Great start! Just 2 more words...
                  </div>
                )}
                {wordCount === 4 && (
                  <div className={`text-xs font-medium px-3 py-2 rounded-lg border animate-slideInUp ${
                    isDarkMode 
                      ? 'text-orange-400 bg-orange-900/30 border-orange-700' 
                      : 'text-orange-600 bg-orange-50 border-orange-200'
                  }`}>
                    🔥 Almost there! Just 1 more word...
                  </div>
                )}
              </div>
              
              {/* AI Auto-Suggestions */}
              {aiSuggestions && wordCount >= 5 && (
                <div className={`mt-3 p-3 rounded-lg border-2 animate-slideDown ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-indigo-700' 
                    : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className={`w-4 h-4 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <h4 className={`text-xs font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      AI Suggestions
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      aiSuggestions.priority === 'P1' 
                        ? 'bg-red-500 text-white' 
                        : aiSuggestions.priority === 'P2' 
                        ? 'bg-orange-500 text-white' 
                        : aiSuggestions.priority === 'P3' 
                        ? 'bg-yellow-500 text-white' 
                        : 'bg-green-500 text-white'
                    }`}>
                      Priority: {aiSuggestions.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      aiSuggestions.impact === 'Critical' 
                        ? 'bg-red-600 text-white' 
                        : aiSuggestions.impact === 'High' 
                        ? 'bg-orange-600 text-white' 
                        : aiSuggestions.impact === 'Medium' 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      Impact: {aiSuggestions.impact}
                    </span>
                    {aiSuggestions.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          isDarkMode 
                            ? 'bg-gray-700 text-gray-300' 
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                Upload Image/Video (Optional)
              </label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all file-upload-area ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105' 
                    : isDarkMode 
                    ? 'border-gray-600 hover:border-blue-400' 
                    : 'border-gray-300 hover:border-blue-500'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  multiple
                />
                {files.length > 0 ? (
                  <div className="space-y-4">
                    {/* File Count */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        📎 {files.length}/10 files uploaded
                      </span>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearAllFiles();
                        }}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium"
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Files Gallery */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                      {files.map((fileItem) => (
                        <div 
                          key={fileItem.id}
                          className={`relative group rounded-lg overflow-hidden border-2 ${
                            isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                          } hover:border-blue-500 transition-all`}
                        >
                          {/* File Preview */}
                          {fileItem.type.startsWith('image/') ? (
                            <img 
                              src={fileItem.preview} 
                              alt={fileItem.name} 
                              className="w-full h-24 object-cover" 
                            />
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500">
                              <Video className="w-8 h-8 text-white" />
                            </div>
                          )}

                          {/* File Info Overlay */}
                          <div className={`p-2 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {fileItem.name}
                            </p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              {(fileItem.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeFile(fileItem.id);
                            }}
                            className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="Remove file"
                          >
                            <CloseIcon className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}

                      {/* Add More Button */}
                      {files.length < 10 && (
                        <label 
                          htmlFor="file-upload" 
                          className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                            isDarkMode 
                              ? 'border-gray-600 hover:border-blue-400 bg-gray-800/50' 
                              : 'border-gray-300 hover:border-blue-500 bg-gray-50'
                          }`}
                        >
                          <Upload className={`w-6 h-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                          <span className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Add More
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <label 
                    htmlFor="file-upload"
                    className="space-y-2 cursor-pointer block"
                  >
                    <Upload className={`w-12 h-12 mx-auto ${isDragging ? 'text-blue-500 animate-bounce' : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {isDragging ? 'Drop files here!' : 'Click to upload or drag and drop'}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Images & Videos • Max 10 files • Max 50MB per file
                    </p>
                  </label>
                )}
              </div>
            </div>


            {/* Generate Button */}
            <button
              onClick={generateTicket}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-glow btn-ripple shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="animate-pulse">Generating Ticket...</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Generate Detailed Ticket
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className={`${isDarkMode ? 'bg-gray-800/90' : 'bg-white/90'} backdrop-blur-sm rounded-xl shadow-lg p-6 animate-slideInRight card-float`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} flex items-center gap-2`}>
                <span className="text-3xl">📋</span>
                Generated Ticket
              </h2>
              {ticket && (
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                } animate-pulse`}>
                  Ready to use
                </div>
              )}
            </div>
            
            {!ticket && !loading && (
              <div className={`h-full flex items-center justify-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-center animate-float">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Your detailed bug ticket will appear here</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="h-full flex items-center justify-center min-h-[400px] py-8 overflow-y-auto">
                <div className="text-center w-full px-4 max-w-2xl mx-auto">
                  {/* AI-Powered Loading Animation */}
                  <div className="relative mb-6">
                    {/* Animated AI Brain/Sparkle Icon */}
                    <div className="relative inline-block">
                      <div className="relative">
                        <Sparkles className={`w-16 h-16 mx-auto ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} animate-pulse`} />
                        {/* Rotating rings around the icon */}
                        <div className={`absolute inset-0 border-4 ${isDarkMode ? 'border-blue-500/30' : 'border-blue-300/50'} rounded-full animate-spin`} style={{ animationDuration: '3s' }}></div>
                        <div className={`absolute inset-0 border-4 ${isDarkMode ? 'border-purple-500/30' : 'border-purple-300/50'} rounded-full animate-spin`} style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
                  </div>
                  
                      {/* Floating particles effect */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {[...Array(6)].map((_, i) => (
                          <div
                            key={i}
                            className={`absolute w-2 h-2 ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'} rounded-full opacity-60 animate-ping`}
                            style={{
                              top: '50%',
                              left: '50%',
                              transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-35px)`,
                              animationDelay: `${i * 0.2}s`,
                              animationDuration: '2s'
                            }}
                          />
                        ))}
                      </div>
                      </div>
                    </div>
                    
                  {/* AI Conversational Messages */}
                  <div className="space-y-4">
                    {/* Main Loading Message */}
                    <div className="space-y-2">
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} flex items-center justify-center gap-2 flex-wrap`}>
                        <span className="animate-bounce">🤖</span>
                        <span>AI is working its magic</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>✨</span>
                      </h3>
                      
                      {/* Dynamic Loading Step with Typing Effect */}
                      <div className={`min-h-[50px] flex items-center justify-center px-2`}>
                        <p className={`${isDarkMode ? 'text-blue-300' : 'text-blue-600'} text-base font-medium flex items-center gap-2 flex-wrap justify-center`}>
                          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></span>
                          <span className="animate-fadeIn text-center">{loadingStep || 'Preparing your ticket...'}</span>
                        </p>
                        </div>
                      </div>

                    {/* Skeleton Preview with Fade */}
                    <div className="mb-4 max-w-md mx-auto opacity-60 animate-pulse">
                      <TicketSkeleton isDarkMode={isDarkMode} />
                    </div>

                    {/* Fun AI Messages */}
                    <div className={`rounded-xl p-3 ${isDarkMode ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/30' : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'}`}>
                      <p className={`text-xs ${isDarkMode ? 'text-blue-200' : 'text-blue-700'} font-medium`}>
                        {countdown > 10 ? '🧠 Analyzing your description and files...' :
                         countdown > 5 ? '✍️ Crafting a detailed ticket for you...' :
                         '🎯 Almost there! Finalizing details...'}
                      </p>
                    </div>
                    
                    {/* Subtle Progress Indicator */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <div className={`h-1 w-24 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} overflow-hidden`}>
                        <div 
                          className={`h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse`}
                          style={{ 
                            width: `${Math.min(100 - (countdown * 5), 95)}%`,
                            transition: 'width 0.5s ease-out'
                          }}
                        />
                      </div>
                      {countdown > 0 && (
                        <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} whitespace-nowrap`}>
                          ~{countdown}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ticket && (
              <div className="space-y-4 animate-fadeIn">
                {/* Edit Button */}
                {!isEditingTicket && (
                  <div className="flex items-center justify-end gap-2">
                    {originalTicket && ticket !== originalTicket && (
                      <button
                        onClick={handleResetToOriginal}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        title="Reset to original AI-generated version"
                      >
                        🔄 Reset to Original
                      </button>
                    )}
                    <button
                      onClick={handleEditTicket}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all shadow-md btn-glow text-sm flex items-center gap-2"
                      title="Edit ticket content"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}

                {/* Formatted Ticket or Editable Textarea */}
                {isEditingTicket ? (
                  <div className={`rounded-lg p-5 border-2 ${
                    isDarkMode 
                      ? 'bg-gray-900 border-blue-500' 
                      : 'bg-white border-blue-400'
                  }`}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className={`text-sm font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        ✏️ Editing Mode - Make your changes below
                      </p>
                      <button
                        onClick={handleCancelEdit}
                        className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                    <textarea
                      value={editedTicket}
                      onChange={(e) => setEditedTicket(e.target.value)}
                      className={`w-full h-[600px] p-4 rounded-lg border-2 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-gray-200' 
                          : 'bg-gray-50 border-gray-300 text-gray-900'
                      }`}
                      placeholder="Edit your ticket content here..."
                    />
                  </div>
                ) : (
                  <div className={`rounded-lg p-5 max-h-[600px] overflow-y-auto animate-scaleIn shadow-inner border ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700' 
                      : 'bg-gradient-to-br from-gray-50 to-blue-50 border-gray-200'
                  }`}>
                    <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      <FormattedTicket ticket={ticket} isDarkMode={isDarkMode} />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {copied && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-3 flex items-center gap-2 animate-slideDown success-pop">
                      <CheckCircle className="w-6 h-6 text-blue-600 animate-bounce" />
                      <p className="text-sm text-blue-700 font-semibold">Copied to clipboard!</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {isEditingTicket ? (
                      <button
                        onClick={handleSaveTicketClick}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md btn-glow btn-ripple text-sm flex items-center justify-center gap-1 col-span-2"
                        title="Save your edits"
                      >
                        💾 Save Changes
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleCopyToClipboard}
                          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md btn-glow btn-ripple text-sm"
                          title="Copy to clipboard"
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={handleDownloadTicket}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md btn-glow btn-ripple text-sm flex items-center justify-center gap-1"
                          title="Download as text file"
                        >
                          <Download className="w-4 h-4" />
                          Save
                        </button>
                      </>
                    )}
                    <button
                      onClick={pushToJira}
                      disabled={isPushingToJira}
                      className="bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md btn-glow btn-ripple text-sm flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                      title="Push to Jira"
                    >
                      {isPushingToJira ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Pushing...</span>
                          </div>
                          {jiraPushStep && (
                            <span className="text-xs opacity-80 whitespace-nowrap">
                              {jiraPushStep}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          Push to Jira
                        </>
                      )}
                    </button>
                    <button
                      onClick={resetForm}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-md btn-glow btn-ripple text-sm"
                      title="Create new ticket"
                    >
                      ✨ New
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`mt-8 ${isDarkMode ? 'bg-gray-800/90' : 'bg-white/90'} backdrop-blur-sm rounded-xl shadow-lg p-6 animate-fadeIn card-float`}>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4 text-center`}>How It Works</h3>
          <div className={`grid md:grid-cols-3 gap-6 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <div className={`flex flex-col items-center text-center gap-3 p-4 rounded-lg transition-all duration-300 animate-slideUp stagger-1 ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'
            }`}>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-lg animate-float">
                1
              </div>
              <div>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-1`}>Describe the Bug</p>
                <p className="text-xs">Write a brief description of the issue you encountered</p>
              </div>
            </div>
            <div className={`flex flex-col items-center text-center gap-3 p-4 rounded-lg transition-all duration-300 animate-slideUp stagger-2 ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'
            }`}>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-lg animate-float" style={{animationDelay: '0.5s'}}>
                2
              </div>
              <div>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-1`}>Upload Media</p>
                <p className="text-xs">Optionally upload screenshots or videos showing the bug</p>
              </div>
            </div>
            <div className={`flex flex-col items-center text-center gap-3 p-4 rounded-lg transition-all duration-300 animate-slideUp stagger-3 ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'
            }`}>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-lg animate-float" style={{animationDelay: '1s'}}>
                3
              </div>
              <div>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-1`}>Get Detailed Ticket</p>
                <p className="text-xs">AI analyzes and generates a comprehensive bug report</p>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Achievement Footer */}
        <div className="mt-8 text-center animate-fadeIn">
          <a 
            href="https://www.linkedin.com/in/mrkishanagrawal/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block group"
          >
            <div className={`relative overflow-hidden px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 ${
              isDarkMode 
                ? 'bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900 border border-yellow-500/30' 
                : 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600'
            }`}>
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
              
              {/* Sparkle Effects */}
              <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-yellow-300 text-sm animate-ping">✨</span>
              </div>
              <div className="absolute top-1 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                <span className="text-yellow-300 text-sm animate-ping">✨</span>
              </div>
              
              {/* Content - Horizontal Layout */}
              <div className="relative z-10 flex items-center justify-center gap-3">
                {/* Trophy Icon with Pulse */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-40 animate-pulse"></div>
                  <div className="relative text-2xl golden-shine">
                    🏆
                  </div>
                </div>
                
                {/* Creator Text - Compact */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-semibold">
                      Created by
                    </p>
                    <p className="text-white text-base font-extrabold tracking-wide">
                      Kishan Agrawal
                    </p>
                  </div>
                  <p className={`text-[11px] font-medium italic ${isDarkMode ? 'text-yellow-300' : 'text-yellow-100'}`}>
                    Transforming Bug Reporting • © 2025
                  </p>
                </div>
                
                {/* Arrow indicator */}
                <svg className="w-4 h-4 text-white/60 transform group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
            onClick={() => setShowHistory(false)}
          />
          
          {/* Sidebar Panel */}
          <div 
            className={`fixed top-0 left-0 h-full w-full md:w-96 z-50 ${
              isDarkMode ? 'bg-gray-900' : 'bg-white'
            } shadow-2xl animate-slideInLeft overflow-y-auto`}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <History className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Ticket History
                  </h3>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  }`}
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              
              {/* History List */}
              {ticketHistory.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No ticket history yet</p>
                  <p className="text-xs mt-2">Generated tickets will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticketHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 transition-all hover:scale-[1.02] cursor-pointer ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 hover:border-indigo-500' 
                          : 'bg-gray-50 border-gray-200 hover:border-indigo-400'
                      }`}
                      onClick={() => loadHistoryTicket(item)}
                    >
                      {/* Timestamp */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.id);
                          }}
                          className={`p-1 rounded hover:bg-red-500 hover:text-white transition-colors ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                          title="Delete"
                        >
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {/* Description Preview */}
                      <p className={`text-sm mb-2 line-clamp-2 ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        {item.description}
                      </p>
                      
                      {/* Media Badge */}
                      {item.hasMedia && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}>
                          <FileText className="w-3 h-3" />
                          Has media
                        </span>
                      )}
                    </div>
                  ))}
                  
                  {/* Clear All Button */}
                  {ticketHistory.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm('Clear all ticket history?')) {
                          setTicketHistory([]);
                          localStorage.removeItem('ticketHistory');
                          setToast({ message: '🗑️ History cleared', type: 'success' });
                        }
                      }}
                      className={`w-full mt-4 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                        isDarkMode 
                          ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50 border border-red-700' 
                          : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                      }`}
                    >
                      Clear All History
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Jira Settings Modal */}
      {showJiraSettings && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 z-50 animate-fadeIn"
            onClick={() => setShowJiraSettings(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className={`relative w-full max-w-lg my-8 ${
              isDarkMode ? 'bg-gray-900' : 'bg-white'
            } rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col`}>
              {/* Header */}
              <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        Jira Integration
                      </h3>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Configure your Jira connection
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowJiraSettings(false)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div 
                className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]"
                onWheel={(e) => e.stopPropagation()}
              >
                {/* Jira URL */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Jira URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jiraConfig.url}
                    readOnly
                    className={`w-full px-4 py-2.5 border-2 rounded-lg transition-all cursor-not-allowed ${
                      isDarkMode 
                        ? 'bg-gray-900/50 border-gray-700 text-gray-400' 
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                    }`}
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={jiraConfig.email}
                    onChange={(e) => setJiraConfig({...jiraConfig, email: e.target.value})}
                    placeholder="your-email@company.com"
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
                
                {/* API Token */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    API Token <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={jiraConfig.apiToken}
                    onChange={(e) => setJiraConfig({...jiraConfig, apiToken: e.target.value})}
                    placeholder="Your Jira API token"
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Create API token →
                  </a>
                </div>
                
                {/* Project Key */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Project Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jiraConfig.projectKey}
                    onChange={(e) => setJiraConfig({...jiraConfig, projectKey: e.target.value.toUpperCase()})}
                    placeholder="PROJ"
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    It should be WE, because WE stands for WorkSpan Engineering.
                  </p>
                </div>
                
                {/* Instance */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Instance <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={jiraConfig.instance}
                    onChange={(value) => setJiraConfig({...jiraConfig, instance: value})}
                    options={JIRA_INSTANCES}
                    placeholder="Select Instance"
                    isDarkMode={isDarkMode}
                  />
                </div>
                
                {/* Product Line */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Product Line <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={jiraConfig.productLine}
                    onChange={(value) => setJiraConfig({...jiraConfig, productLine: value})}
                    options={JIRA_PRODUCT_LINES}
                    placeholder="Select Product Line"
                    isDarkMode={isDarkMode}
                  />
                </div>
                
                {/* Component */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Component <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={jiraConfig.component}
                    onChange={(value) => setJiraConfig({...jiraConfig, component: value})}
                    options={JIRA_COMPONENTS}
                    placeholder="Select Component"
                    isDarkMode={isDarkMode}
                  />
                </div>
                
                {/* Found Version */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Found Version <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jiraConfig.foundVersion}
                    onChange={(e) => setJiraConfig({...jiraConfig, foundVersion: e.target.value})}
                    placeholder="e.g., 194.0.0, 193.0.0"
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
                
                {/* Engineering Team */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Engineering Team <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={jiraConfig.engineeringTeam}
                    onChange={(value) => setJiraConfig({...jiraConfig, engineeringTeam: value})}
                    options={JIRA_ENGINEERING_TEAMS}
                    placeholder="Select Engineering Team"
                    isDarkMode={isDarkMode}
                  />
                </div>

                {/* Divider */}
                <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} my-4`}></div>

                {/* Environment Configuration Section */}
                <div className="space-y-4">
                  <div>
                    <h4 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'} flex items-center gap-2`}>
                      <span>🌍</span>
                      Environment Configuration
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                      Save your environment details to auto-fill in generated tickets
                    </p>
                  </div>

                  {/* Instance URL */}
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Instance URL
                    </label>
                    <input
                      type="text"
                      value={environmentConfig.instance}
                      onChange={(e) => setEnvironmentConfig({...environmentConfig, instance: e.target.value})}
                      placeholder="https://workspan-staging-2.qa.workspan.app/"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Branch */}
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Branch
                    </label>
                    <input
                      type="text"
                      value={environmentConfig.branch}
                      onChange={(e) => setEnvironmentConfig({...environmentConfig, branch: e.target.value})}
                      placeholder="e.g., release-195, main, develop"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Username
                    </label>
                    <input
                      type="text"
                      value={environmentConfig.username}
                      onChange={(e) => setEnvironmentConfig({...environmentConfig, username: e.target.value})}
                      placeholder="Your username or email"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={environmentConfig.password}
                      onChange={(e) => setEnvironmentConfig({...environmentConfig, password: e.target.value})}
                      placeholder="Your password"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  {/* Custom Environment Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        Custom Fields
                      </label>
                      <button
                        type="button"
                        onClick={addCustomEnvironmentField}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all ${
                          isDarkMode
                            ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        Add Field
                      </button>
                    </div>
                    
                    {environmentConfig.customFields.length > 0 && (
                      <div className="space-y-2">
                        {environmentConfig.customFields.map((field, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => updateCustomEnvironmentField(index, e.target.value, field.value)}
                              placeholder="Field name"
                              className={`flex-1 px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm ${
                                isDarkMode 
                                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                              }`}
                            />
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => updateCustomEnvironmentField(index, field.key, e.target.value)}
                              placeholder="Field value"
                              className={`flex-1 px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm ${
                                isDarkMode 
                                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => removeCustomEnvironmentField(index)}
                              className={`p-2 rounded-lg transition-all ${
                                isDarkMode
                                  ? 'text-red-400 hover:bg-red-900/20'
                                  : 'text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {environmentConfig.customFields.length === 0 && (
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} italic`}>
                        No custom fields. Click "Add Field" to add one.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex gap-3`}>
                <button
                  onClick={() => setShowJiraSettings(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    isDarkMode 
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={testJiraConnection}
                  disabled={!jiraConfig.url || !jiraConfig.email || !jiraConfig.apiToken || isTestingConnection}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                  }`}
                >
                  {isTestingConnection ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>
                <button
                  onClick={saveJiraConfig}
                  disabled={!jiraConfig.url || !jiraConfig.email || !jiraConfig.apiToken || !jiraConfig.projectKey || !jiraConfig.instance || !jiraConfig.productLine || !jiraConfig.component || !jiraConfig.foundVersion || !jiraConfig.engineeringTeam}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ticket Format Settings Modal */}
      {showTicketFormatSettings && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 z-50 animate-fadeIn"
            onClick={() => setShowTicketFormatSettings(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className={`relative w-full max-w-2xl my-8 ${
              isDarkMode ? 'bg-gray-900' : 'bg-white'
            } rounded-xl shadow-2xl border-2 ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            } animate-scaleIn`}
            onWheel={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        Customize Ticket Format
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Drag to reorder • Check to enable • Add custom fields
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTicketFormatSettings(false)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div 
                className="px-6 py-4 space-y-3 overflow-y-auto max-h-[60vh]"
                onWheel={(e) => e.stopPropagation()}
              >
                {ticketFormat.map((field, index) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={(e) => handleFormatDragStart(e, field.id)}
                    onDragOver={handleFormatDragOver}
                    onDrop={(e) => handleFormatDrop(e, field.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      draggedField === field.id
                        ? 'opacity-50 border-blue-500'
                        : isDarkMode
                        ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    } cursor-move`}
                  >
                    {/* Drag Handle */}
                    <div className={`flex flex-col gap-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span className="text-xs">⋮⋮</span>
                    </div>

                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={() => toggleFieldEnabled(field.id)}
                      className="w-5 h-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Field Name */}
                    <div className="flex-1">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {field.name}
                      </span>
                      {field.isDefault && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}>
                          Default
                        </span>
                      )}
                    </div>

                    {/* Move Buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveField(field.id, 'up')}
                        disabled={index === 0}
                        className={`p-1 rounded ${
                          index === 0
                            ? 'opacity-30 cursor-not-allowed'
                            : isDarkMode
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                        }`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveField(field.id, 'down')}
                        disabled={index === ticketFormat.length - 1}
                        className={`p-1 rounded ${
                          index === ticketFormat.length - 1
                            ? 'opacity-30 cursor-not-allowed'
                            : isDarkMode
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                        }`}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    {/* Delete Button (only for custom fields) */}
                    {!field.isDefault && (
                      <button
                        onClick={() => deleteField(field.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkMode
                            ? 'hover:bg-red-900/30 text-red-400'
                            : 'hover:bg-red-50 text-red-600'
                        }`}
                        title="Delete field"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add Custom Field Button */}
                <button
                  onClick={addCustomField}
                  className={`w-full mt-4 p-3 rounded-lg border-2 border-dashed transition-all ${
                    isDarkMode
                      ? 'border-gray-600 hover:border-purple-500 bg-gray-800/50 text-gray-300'
                      : 'border-gray-300 hover:border-purple-400 bg-gray-50 text-gray-700'
                  } flex items-center justify-center gap-2 font-medium`}
                >
                  <span className="text-xl">+</span>
                  Add Custom Field
                </button>
              </div>

              {/* Footer */}
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex gap-3`}>
                <button
                  onClick={resetTicketFormat}
                  className={`px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    isDarkMode 
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Reset to Default
                </button>
                <button
                  onClick={() => setShowTicketFormatSettings(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    isDarkMode 
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveTicketFormat}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  Save Format
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save Confirmation Dialog */}
      {showSaveDialog && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fadeIn"
            onClick={() => setShowSaveDialog(false)}
          />
          
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className={`relative w-full max-w-md ${
                isDarkMode ? 'bg-gray-900' : 'bg-white'
              } rounded-xl shadow-2xl border-2 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              } animate-scaleIn`}
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-6 border-b-2 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Save Changes?
                  </h3>
                </div>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className={`text-base leading-relaxed mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  You're about to save your edits to the ticket.
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  This will replace the AI-generated content with your edited version.
                </p>
              </div>

              {/* Actions */}
              <div className={`flex gap-3 p-6 border-t-2 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    isDarkMode 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  ← Back
                </button>
                <button
                  onClick={handleFinallySave}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all shadow-md btn-glow"
                >
                  ✅ Finally Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}


