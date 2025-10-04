import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Divider,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AiIcon,
  Person as UserIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Help as HelpIcon,
  Code as CodeIcon,
  Close as CloseIcon,
  Lightbulb as LightbulbIcon,
  TableChart as TableIcon,
  AutoAwesome as SparkleIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';

const ChatContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 1300,
}));

const ChatButton = styled(IconButton)(({ theme }) => ({
  width: 60,
  height: 60,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  boxShadow: theme.shadows[8],
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
    transform: 'scale(1.05)',
  },
  transition: 'all 0.2s ease-in-out',
}));

const ChatWindow = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: 90,
  right: 20,
  width: '420px',
  height: '600px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: theme.shadows[16],
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  zIndex: 1301,
  [theme.breakpoints.down('sm')]: {
    width: 'calc(100vw - 40px)',
    height: 'calc(100vh - 140px)',
    bottom: 70,
    right: 20,
    left: 20,
  },
}));

const ChatHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

const MessagesContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: theme.spacing(1),
  backgroundColor: theme.palette.grey[50],
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.grey[100],
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[300],
    borderRadius: '3px',
  },
}));

const MessageBubble = styled(Paper)(({ theme, sender }) => ({
  padding: theme.spacing(1.5),
  margin: theme.spacing(0.5, 0),
  maxWidth: '85%',
  alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
  backgroundColor: sender === 'user' 
    ? theme.palette.primary.main 
    : theme.palette.background.paper,
  color: sender === 'user' 
    ? theme.palette.primary.contrastText 
    : theme.palette.text.primary,
  borderRadius: sender === 'user' 
    ? '20px 20px 5px 20px' 
    : '20px 20px 20px 5px',
  wordBreak: 'break-word',
  '& .message-content': {
    '& h1, & h2, & h3': {
      fontSize: '1rem',
      fontWeight: 600,
      margin: theme.spacing(0.5, 0),
    },
    '& p': {
      margin: theme.spacing(0.5, 0),
    },
    '& ul, & ol': {
      margin: theme.spacing(0.5, 0),
      paddingLeft: theme.spacing(2),
    },
    '& code': {
      backgroundColor: theme.palette.grey[100],
      padding: theme.spacing(0.25, 0.5),
      borderRadius: 4,
      fontSize: '0.875rem',
    },
    '& pre': {
      backgroundColor: theme.palette.grey[100],
      padding: theme.spacing(1),
      borderRadius: 8,
      overflow: 'auto',
      margin: theme.spacing(0.5, 0),
    },
  },
}));

const InputContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const SuggestionChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.25),
  fontSize: '0.75rem',
  height: 28,
  '&:hover': {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
  },
}));

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [schema, setSchema] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // chat, history, help
  const [llmStatus, setLlmStatus] = useState(null); // Track local LLM status
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial data when opening
  useEffect(() => {
    if (isOpen && suggestions.length === 0) {
      loadSuggestions();
      loadSchema();
      loadLLMStatus();
    }
  }, [isOpen]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const getWelcomeMessage = () => {
        if (!llmStatus) {
          return `👋 **Hello! I'm your AI assistant for the Study Room Management System.**

🔄 **Loading AI Configuration...** - Please wait while I check the system status.

I can help you with:
• 📊 Student statistics and reports
• 💰 Payment trends and revenue analysis
• 🪑 Seat occupancy and availability  
• 📈 Business analytics and insights
• 📋 Custom data queries

Try asking me something like "How many active students do we have?" or click on a suggestion below!`;
        }

        if (llmStatus.currentConfig?.useDemoMode) {
          return `👋 **Hello! I'm your AI assistant for the Study Room Management System.**

🎯 **Demo Mode Active** - I can help you analyze your data using intelligent query recognition!

I can help you with:
• 📊 Student statistics and reports
• 💰 Payment trends and revenue analysis
• 🪑 Seat occupancy and availability  
• 📈 Business analytics and insights
• 📋 Custom data queries

Try asking me something like "How many active students do we have?" or click on a suggestion below!

💡 **Note**: Currently running in demo mode with pre-built intelligence - no external API calls required!`;
        }

        if (llmStatus.currentConfig?.useLocalLLM && llmStatus.status?.isAvailable) {
          return `👋 **Hello! I'm your AI assistant for the Study Room Management System.**

🤖 **Local AI Powered** - Running ${llmStatus.status.backend} with ${llmStatus.status.model} model!

I can help you with:
• 📊 Student statistics and reports
• 💰 Payment trends and revenue analysis
• 🪑 Seat occupancy and availability  
• 📈 Business analytics and insights
• 📋 Custom data queries
• 🔍 Complex natural language queries

Try asking me something like "How many active students do we have?" or click on a suggestion below!

🚀 **Benefits**: Fully offline, unlimited queries, no costs, complete privacy!`;
        }

        // Fallback for other configurations
        return `👋 **Hello! I'm your AI assistant for the Study Room Management System.**

🎯 **AI Assistant Ready** - I can help you analyze your data and answer questions!

I can help you with:
• 📊 Student statistics and reports
• 💰 Payment trends and revenue analysis
• 🪑 Seat occupancy and availability  
• 📈 Business analytics and insights
• 📋 Custom data queries

Try asking me something like "How many active students do we have?" or click on a suggestion below!`;
      };

      setMessages([{
        id: Date.now(),
        sender: 'ai',
        content: getWelcomeMessage(),
        timestamp: new Date(),
        type: 'text'
      }]);
    }
  }, [isOpen, llmStatus]);

  const loadSuggestions = async () => {
    try {
      const response = await fetch('/api/admin/ai-chat/suggestions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const loadSchema = async () => {
    try {
      const response = await fetch('/api/admin/ai-chat/schema', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSchema(data.schema || []);
      }
    } catch (error) {
      console.error('Failed to load schema:', error);
    }
  };

  const loadLLMStatus = async () => {
    try {
      const response = await fetch('/api/admin/ai-chat/llm/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLlmStatus(data.data || null);
      }
    } catch (error) {
      console.error('Failed to load LLM status:', error);
      setLlmStatus(null);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/admin/ai-chat/history?limit=20', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const sendMessage = async (query = inputValue) => {
    if (!query.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: query.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);
    setError(null);

    try {
      const response = await fetch('/api/admin/ai-chat/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: query.trim() })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const aiMessage = {
          id: Date.now() + 1,
          sender: 'ai',
          content: data.response,
          timestamp: new Date(),
          type: data.responseType === 'html' ? 'html' : 'text',
          metadata: data.metadata,
          data: data.data
        };

        setMessages(prev => [...prev, aiMessage]);

        // Show data table if there's structured data
        if (data.data && data.data.length > 0) {
          const tableMessage = {
            id: Date.now() + 2,
            sender: 'ai',
            content: data.data,
            timestamp: new Date(),
            type: 'table',
            metadata: data.metadata
          };
          setMessages(prev => [...prev, tableMessage]);
        }
      } else {
        throw new Error(data.message || data.error || 'Failed to process query');
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        content: `❌ **Error:** ${error.message}\n\nPlease try rephrasing your question or check your connection.`,
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (query) => {
    setInputValue(query);
    sendMessage(query);
  };

  const handleHistoryClick = (historyItem) => {
    setInputValue(historyItem.query);
    setActiveTab('chat');
  };

  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
    setError(null);
    // Re-add welcome message
    setTimeout(() => {
      setMessages([{
        id: Date.now(),
        sender: 'ai',
        content: `👋 **Chat cleared!** How can I help you analyze your study room data today?`,
        timestamp: new Date(),
        type: 'text'
      }]);
    }, 100);
  };

  const renderMessage = (message) => {
    if (message.type === 'table' && Array.isArray(message.content)) {
      return (
        <Box key={message.id} sx={{ mb: 1, display: 'flex' }}>
          <Avatar sx={{ mr: 1, bgcolor: 'primary.main', width: 32, height: 32 }}>
            <TableIcon sx={{ fontSize: 16 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, mt: 0.5 }}>
              <Typography variant="subtitle2" gutterBottom>
                📊 Query Results ({message.content.length} rows)
              </Typography>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {Object.keys(message.content[0] || {}).map((header) => (
                        <TableCell key={header} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                          {header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {message.content.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <TableCell key={cellIndex} sx={{ fontSize: '0.75rem' }}>
                            {value?.toString() || 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {message.content.length > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Showing first 10 of {message.content.length} results
                </Typography>
              )}
              {message.metadata?.executionTime && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  ⚡ Query executed in {message.metadata.executionTime}ms
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      );
    }

    return (
      <Box key={message.id} sx={{ mb: 1, display: 'flex', alignItems: 'flex-start' }}>
        <Avatar 
          sx={{ 
            mr: 1, 
            bgcolor: message.sender === 'user' ? 'primary.main' : 'secondary.main',
            width: 32, 
            height: 32 
          }}
        >
          {message.sender === 'user' ? 
            <UserIcon sx={{ fontSize: 16 }} /> : 
            <AiIcon sx={{ fontSize: 16 }} />
          }
        </Avatar>
        <MessageBubble sender={message.sender} elevation={1}>
          <Box className="message-content">
            {message.type === 'error' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon color="error" sx={{ fontSize: 20 }} />
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </Box>
            ) : message.type === 'html' ? (
              <Box 
                dangerouslySetInnerHTML={{ __html: message.content }}
                sx={{
                  '& table.data-table': {
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem',
                    '& th, & td': {
                      border: '1px solid #ddd',
                      padding: '8px',
                      textAlign: 'left'
                    },
                    '& th': {
                      backgroundColor: '#f5f5f5',
                      fontWeight: 600
                    },
                    '& tr:nth-of-type(even)': {
                      backgroundColor: '#f9f9f9'
                    }
                  },
                  '& p': {
                    margin: '8px 0'
                  },
                  '& h3': {
                    margin: '12px 0 8px 0',
                    fontSize: '1.1rem'
                  }
                }}
              />
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {message.timestamp.toLocaleTimeString()}
          </Typography>
          {message.metadata?.sql && (
            <Accordion sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 32 }}>
                <Typography variant="caption">
                  <CodeIcon sx={{ fontSize: 12, mr: 0.5 }} />
                  View SQL Query
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Paper sx={{ p: 1, bgcolor: 'grey.100' }}>
                  <Typography 
                    variant="caption" 
                    component="pre" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.7rem',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-all',
                      margin: 0,
                      maxWidth: '100%'
                    }}
                  >
                    {message.metadata.sql}
                  </Typography>
                </Paper>
              </AccordionDetails>
            </Accordion>
          )}
        </MessageBubble>
      </Box>
    );
  };

  const renderChatTab = () => (
    <>
      <MessagesContainer>
        {messages.map(renderMessage)}
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
              <AiIcon sx={{ fontSize: 16 }} />
            </Avatar>
            <Paper sx={{ p: 1.5, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Analyzing your query...</Typography>
              </Box>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>

      {showSuggestions && suggestions.length > 0 && (
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', maxHeight: 120, overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            💡 Try these suggestions:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {suggestions.slice(0, 2).map(category => 
              category.queries.slice(0, 3).map((query, index) => (
                <SuggestionChip
                  key={`${category.category}-${index}`}
                  label={query}
                  size="small"
                  onClick={() => handleSuggestionClick(query)}
                  icon={<LightbulbIcon sx={{ fontSize: 12 }} />}
                />
              ))
            )}
          </Box>
        </Box>
      )}

      <InputContainer>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            ref={inputRef}
            fullWidth
            size="small"
            placeholder="Ask me about your data..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading}
            multiline
            maxRows={3}
          />
          <IconButton 
            onClick={() => sendMessage()} 
            disabled={!inputValue.trim() || isLoading}
            color="primary"
          >
            <SendIcon />
          </IconButton>
        </Box>
      </InputContainer>
    </>
  );

  const renderHistoryTab = () => (
    <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
      <Button onClick={loadHistory} variant="outlined" size="small" fullWidth sx={{ mb: 2 }}>
        <HistoryIcon sx={{ mr: 1 }} />
        Load Recent Queries
      </Button>
      <List dense>
        {history.map((item) => (
          <ListItemButton
            key={item.id}
            onClick={() => handleHistoryClick(item)}
            sx={{ 
              borderRadius: 1, 
              mb: 0.5,
              '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
            }}
          >
            <ListItemText
              primary={item.query}
              secondary={`${item.timestamp ? new Date(item.timestamp).toLocaleString() : ''} • ${item.success ? 'Success' : 'Failed'}`}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  const renderHelpTab = () => (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        <HelpIcon sx={{ mr: 1 }} />
        How to Use AI Chat
      </Typography>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">💡 Getting Started</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2">
            Ask questions in natural language about your study room data. 
            I can help with analytics, reports, and insights about students, payments, seats, and more.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">📊 Example Questions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List dense>
            {suggestions.slice(0, 3).map(category => (
              <div key={category.category}>
                <Typography variant="caption" color="primary">{category.category}:</Typography>
                {category.queries.slice(0, 2).map((query, idx) => (
                  <ListItem key={idx} dense>
                    <ListItemText 
                      primary={`• ${query}`} 
                      primaryTypographyProps={{ fontSize: '0.8rem' }}
                    />
                  </ListItem>
                ))}
              </div>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">🗃️ Database Tables</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List dense>
            {schema.slice(0, 6).map((table) => (
              <ListItem key={table.name} dense>
                <ListItemText
                  primary={table.name}
                  secondary={table.description}
                  primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
    </Box>
  );

  return (
    <ChatContainer>
      {/* Chat Toggle Button */}
      <Tooltip title="AI Assistant" placement="left">
        <ChatButton onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <CloseIcon /> : <SparkleIcon />}
        </ChatButton>
      </Tooltip>

      {/* Chat Window */}
      {isOpen && (
        <ChatWindow elevation={8}>
          <ChatHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AiIcon />
              <Box>
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                  AI Assistant
                </Typography>
                <Typography variant="caption">
                  {llmStatus ? (
                    llmStatus.currentConfig?.useDemoMode ? 
                      'Demo Mode • Smart Query Engine' :
                    llmStatus.currentConfig?.useLocalLLM && llmStatus.status?.isAvailable ?
                      `Local AI • ${llmStatus.status.backend} (${llmStatus.status.model})` :
                      'AI Chat Assistant'
                  ) : 'Loading...'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                size="small" 
                onClick={() => setActiveTab('chat')}
                sx={{ color: activeTab === 'chat' ? 'primary.contrastText' : 'primary.light' }}
              >
                <AiIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setActiveTab('history')}
                sx={{ color: activeTab === 'history' ? 'primary.contrastText' : 'primary.light' }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setActiveTab('help')}
                sx={{ color: activeTab === 'help' ? 'primary.contrastText' : 'primary.light' }}
              >
                <HelpIcon fontSize="small" />
              </IconButton>
              {activeTab === 'chat' && (
                <IconButton size="small" onClick={clearChat} sx={{ color: 'primary.light' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </ChatHeader>

          {activeTab === 'chat' && renderChatTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'help' && renderHelpTab()}
        </ChatWindow>
      )}
    </ChatContainer>
  );
};

export default AIChatWidget;