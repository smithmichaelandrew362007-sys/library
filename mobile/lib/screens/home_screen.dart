import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback onOpenSettings;

  const HomeScreen({Key? key, required this.onOpenSettings}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const String _urlPrefKey = 'libravault_server_url';
  static const String _defaultUrl = 'https://college-library-tau.vercel.app';

  late final WebViewController _controller;
  String _currentUrl = _defaultUrl;
  int _loadingProgress = 0;
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';
  bool _canGoBack = false;
  bool _canGoForward = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
    _loadSavedUrl();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F172A))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            if (mounted) {
              setState(() {
                _loadingProgress = progress;
                _isLoading = progress < 100;
              });
            }
          },
          onPageStarted: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _hasError = false;
              });
            }
            _updateNavigationButtons();
          },
          onPageFinished: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = false;
              });
            }
            _updateNavigationButtons();
          },
          onWebResourceError: (WebResourceError error) {
            // Ignore minor resource errors (like missing favicons or ads)
            if (error.isForMainFrame) {
              if (mounted) {
                setState(() {
                  _hasError = true;
                  _isLoading = false;
                  _errorMessage = error.description;
                });
              }
            }
          },
        ),
      );
  }

  Future<void> _loadSavedUrl() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString(_urlPrefKey) ?? _defaultUrl;
      setState(() {
        _currentUrl = savedUrl;
      });
      _controller.loadRequest(Uri.parse(savedUrl));
    } catch (_) {
      _controller.loadRequest(Uri.parse(_defaultUrl));
    }
  }

  Future<void> _saveAndLoadUrl(String url) async {
    String formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'http://$formattedUrl';
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_urlPrefKey, formattedUrl);
    } catch (_) {}

    setState(() {
      _currentUrl = formattedUrl;
      _hasError = false;
    });

    _controller.loadRequest(Uri.parse(formattedUrl));
  }

  Future<void> _updateNavigationButtons() async {
    if (!mounted) return;
    final back = await _controller.canGoBack();
    final forward = await _controller.canGoForward();
    setState(() {
      _canGoBack = back;
      _canGoForward = forward;
    });
  }

  void _showServerUrlDialog() {
    final TextEditingController urlController = TextEditingController(text: _currentUrl);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.dns_rounded, color: Color(0xFF6366F1)),
              SizedBox(width: 10),
              Text('Switch Server URL', style: TextStyle(color: Colors.white, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Connect to your live cloud server or a local Wi-Fi server running on your computer.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: urlController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Server Address',
                  labelStyle: const TextStyle(color: Colors.white60),
                  hintText: 'e.g., https://college-library-tau.vercel.app or http://192.168.1.100:5000',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Quick Presets:', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(
                    backgroundColor: const Color(0xFF6366F1).withOpacity(0.2),
                    label: const Text('🌐 Vercel Cloud', style: TextStyle(color: Colors.white, fontSize: 11)),
                    onPressed: () {
                      urlController.text = _defaultUrl;
                    },
                  ),
                  ActionChip(
                    backgroundColor: Colors.white.withOpacity(0.1),
                    label: const Text('💻 Localhost (10.0.2.2:5000)', style: TextStyle(color: Colors.white, fontSize: 11)),
                    onPressed: () {
                      urlController.text = 'http://10.0.2.2:5000';
                    },
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () {
                final newUrl = urlController.text;
                Navigator.of(context).pop();
                if (newUrl.isNotEmpty) {
                  _saveAndLoadUrl(newUrl);
                }
              },
              child: const Text('Connect', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'LibraVault WebApp',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            Text(
              _currentUrl.replaceFirst(RegExp(r'^https?://'), ''),
              style: const TextStyle(fontSize: 11, color: Colors.white60),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            tooltip: 'Back',
            onPressed: _canGoBack ? () => _controller.goBack() : null,
          ),
          IconButton(
            icon: const Icon(Icons.arrow_forward_ios_rounded, size: 18),
            tooltip: 'Forward',
            onPressed: _canGoForward ? () => _controller.goForward() : null,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Reload',
            onPressed: () => _controller.reload(),
          ),
          IconButton(
            icon: const Icon(Icons.dns_rounded),
            tooltip: 'Switch Server URL',
            onPressed: _showServerUrlDialog,
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings & OTA Updates',
            onPressed: widget.onOpenSettings,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_isLoading)
              LinearProgressIndicator(
                value: _loadingProgress > 0 ? _loadingProgress / 100.0 : null,
                backgroundColor: const Color(0xFF0F172A),
                color: const Color(0xFF6366F1),
                minHeight: 3,
              ),
            Expanded(
              child: _hasError ? _buildErrorScreen() : WebViewWidget(controller: _controller),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.cloud_off_rounded,
              size: 64,
              color: Colors.redAccent.withOpacity(0.8),
            ),
            const SizedBox(height: 16),
            const Text(
              'Unable to Connect to Server',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              'Could not load: $_currentUrl\n\nError: $_errorMessage',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  label: const Text('Retry', style: TextStyle(color: Colors.white)),
                  onPressed: () {
                    setState(() {
                      _hasError = false;
                      _isLoading = true;
                    });
                    _controller.reload();
                  },
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF6366F1)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.dns_rounded, color: Color(0xFF6366F1)),
                  label: const Text('Switch Server', style: TextStyle(color: Colors.white)),
                  onPressed: _showServerUrlDialog,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
