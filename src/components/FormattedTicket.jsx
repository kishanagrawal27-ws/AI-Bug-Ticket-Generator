import React from 'react';

const FormattedTicket = ({ ticket, isDarkMode, searchTerm = '' }) => {
  if (!ticket) return null;

  // Section icons mapping
  const getSectionIcon = (text) => {
    if (text.includes('Title:')) return '📝';
    if (text.includes('Description:')) return '📄';
    if (text.includes('Steps to Reproduce:')) return '🔄';
    if (text.includes('Expected Behaviour:')) return '✅';
    if (text.includes('Actual Behaviour:')) return '❌';
    if (text.includes('Impact:')) return '💥';
    if (text.includes('Priority:')) return '🎯';
    if (text.includes('Environment:')) return '🌐';
    if (text.includes('Attachment:')) return '📎';
    return '';
  };

  // Parse and format the ticket with markdown bold
  const formatText = (text) => {
    if (!text) return null;

    // Split by lines
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // Check if line contains bold markdown
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <div key={index} className="mb-2 flex items-start gap-2">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2);
                const icon = getSectionIcon(boldText);
                
                // Highlight search term if present
                if (searchTerm && boldText.toLowerCase().includes(searchTerm.toLowerCase())) {
                  return (
                    <React.Fragment key={i}>
                      {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
                      <strong className={`${isDarkMode ? 'text-blue-300' : 'text-blue-700'} font-extrabold text-lg`}>
                        <span className="bg-yellow-300 text-gray-900 px-1 rounded">{boldText}</span>
                      </strong>
                    </React.Fragment>
                  );
                }
                
                return (
                  <React.Fragment key={i}>
                    {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
                    <strong className={`${isDarkMode ? 'text-blue-300' : 'text-blue-700'} font-extrabold text-lg`}>
                      {boldText}
                    </strong>
                  </React.Fragment>
                );
              }
              
              // Highlight search term in regular text
              if (searchTerm && part.toLowerCase().includes(searchTerm.toLowerCase())) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const highlighted = part.split(regex);
                return (
                  <span key={i}>
                    {highlighted.map((chunk, j) => 
                      chunk.toLowerCase() === searchTerm.toLowerCase() ? (
                        <span key={j} className="bg-yellow-300 text-gray-900 px-1 rounded font-bold">{chunk}</span>
                      ) : (
                        chunk
                      )
                    )}
                  </span>
                );
              }
              
              return <span key={i}>{part}</span>;
            })}
          </div>
        );
      }
      
      // Highlight search term in lines without markdown
      if (searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const highlighted = line.split(regex);
        return (
          <div key={index} className="mb-2">
            {highlighted.map((chunk, j) => 
              chunk.toLowerCase() === searchTerm.toLowerCase() ? (
                <span key={j} className="bg-yellow-300 text-gray-900 px-1 rounded font-bold">{chunk}</span>
              ) : (
                chunk
              )
            )}
          </div>
        );
      }
      
      return <div key={index} className="mb-2">{line || '\u00A0'}</div>;
    });
  };

  return (
    <div className="space-y-1 leading-relaxed">
      {formatText(ticket)}
    </div>
  );
};

export default FormattedTicket;

