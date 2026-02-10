#!/usr/bin/env python3
"""
SPA-friendly HTTP server that serves index.html for all 404s.
This allows React Router to handle routing on the client side.
"""
import os
import sys
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

class SPAHTTPRequestHandler(SimpleHTTPRequestHandler):
    """Custom handler that serves index.html for missing files (SPA routing)"""
    
    def end_headers(self):
        """Add cache control headers"""
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests with SPA fallback"""
        # Try to serve the requested file
        path = self.translate_path(self.path)
        
        # If file doesn't exist and it's not a static asset, serve index.html
        if not os.path.isfile(path):
            # Don't fallback for actual asset files
            if not self.path.startswith('/assets/'):
                self.path = '/index.html'
        
        super().do_GET()

def run(port=3000, directory='dist'):
    """Run the SPA server"""
    # Change to the dist directory
    os.chdir(directory)
    
    server_address = ('', port)
    httpd = HTTPServer(server_address, SPAHTTPRequestHandler)
    
    print(f'✅ SPA Server running on http://localhost:{port}/')
    print(f'📂 Serving: {os.getcwd()}')
    print('Press Ctrl+C to stop\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n✓ Server stopped')
        sys.exit(0)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    directory = sys.argv[2] if len(sys.argv) > 2 else 'dist'
    run(port, directory)
