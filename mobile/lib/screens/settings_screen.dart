import 'dart:async';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:ota_update/ota_update.dart';
import '../services/update_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _appVersion = 'Loading...';
  String _buildNumber = '';
  bool _isCheckingUpdate = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState() ;
    _loadAppInfo();
  }

  Future<void> _loadAppInfo() async {
    try {
      final info = await PackageInfo.fromPlatform();
      setState(() {
        _appVersion = info.version;
        _buildNumber = info.buildNumber;
      });
    } catch (_) {
      setState(() {
        _appVersion = '1.0.0';
      });
    }
  }

  Future<void> _handleCheckForUpdates() async {
    setState(() {
      _isCheckingUpdate = true;
      _errorMessage = null;
    });

    try {
      final updateInfo = await UpdateService.checkForUpdate();

      if (!mounted) return;
      setState(() {
        _isCheckingUpdate = false;
      });

      if (updateInfo.hasUpdate) {
        _showUpdateAvailableDialog(updateInfo);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.greenAccent),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'You are using the latest version (v$_appVersion).',
                  ),
                ),
              ],
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF1E293B),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isCheckingUpdate = false;
        _errorMessage = e.toString();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error checking for updates: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showUpdateAvailableDialog(UpdateInfo updateInfo) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return _UpdateDialog(updateInfo: updateInfo);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // App Information Header
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
            color: theme.colorScheme.surfaceVariant.withOpacity(0.4),
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        Icons.phone_android_rounded,
                        color: theme.colorScheme.primary,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'LibraVault Mobile',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Version $_appVersion${_buildNumber.isNotEmpty ? ' ($_buildNumber)' : ''}',
                            style: TextStyle(
                              color: theme.colorScheme.onSurfaceVariant,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
            child: Text('APP UPDATES & RELEASES'),
          ),

          // Update Check Section
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
            child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.indigo.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.system_update_rounded,
                  color: Colors.indigoAccent,
                ),
              ),
              title: const Text(
                'Check for Updates',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              subtitle: Text(
                _isCheckingUpdate
                    ? 'Connecting to GitHub Releases...'
                    : 'Download & install latest APK',
              ),
              trailing: _isCheckingUpdate
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : const Icon(Icons.arrow_forward_ios_rounded, size: 16),
              onTap: _isCheckingUpdate ? null : _handleCheckForUpdates,
            ),
          ),

          const SizedBox(height: 24),

          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
            child: Text('ABOUT & BUILD'),
          ),

          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.info_outline_rounded),
                  title: const Text('Target Repository'),
                  subtitle: const Text('github.com/smithmichaelandrew362007-sys/library'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.build_outlined),
                  title: const Text('Distribution Mode'),
                  subtitle: const Text('Direct APK via GitHub Actions Release'),
                ),
              ],
            ),
          ),

          if (_errorMessage != null) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.shade400.withOpacity(0.5)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.redAccent),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _UpdateDialog extends StatefulWidget {
  final UpdateInfo updateInfo;

  const _UpdateDialog({Key? key, required this.updateInfo}) : super(key: key);

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _isDownloading = false;
  String _downloadProgressText = '0%';
  double _progressPercentage = 0.0;
  String? _downloadError;
  StreamSubscription<OtaEvent>? _otaSubscription;

  @override
  void dispose() {
    _otaSubscription?.cancel();
    super.dispose();
  }

  void _startDownload() {
    setState(() {
      _isDownloading = true;
      _downloadError = null;
      _downloadProgressText = 'Starting download...';
      _progressPercentage = 0.0;
    });

    try {
      _otaSubscription = UpdateService.downloadAndInstallApk(widget.updateInfo.apkUrl)
          .listen((OtaEvent event) {
        if (!mounted) return;

        setState(() {
          switch (event.status) {
            case OtaStatus.DOWNLOADING:
              final value = double.tryParse(event.value ?? '0') ?? 0.0;
              _progressPercentage = value / 100.0;
              _downloadProgressText = '${value.toInt()}%';
              break;
            case OtaStatus.INSTALLING:
              _downloadProgressText = 'Opening installer...';
              _progressPercentage = 1.0;
              break;
            case OtaStatus.ALREADY_RUNNING_ERROR:
              _downloadError = 'An update process is already running.';
              _isDownloading = false;
              break;
            case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
              _downloadError = 'Permission denied to install unknown apps.';
              _isDownloading = false;
              break;
            case OtaStatus.INTERNAL_ERROR:
              _downloadError = 'Internal error during download: ${event.value}';
              _isDownloading = false;
              break;
            case OtaStatus.DOWNLOAD_ERROR:
              _downloadError = 'Download failed. Please check internet connection.';
              _isDownloading = false;
              break;
            case OtaStatus.CHECKSUM_ERROR:
              _downloadError = 'Checksum error on downloaded APK.';
              _isDownloading = false;
              break;
            default:
              break;
          }
        });
      }, onError: (error) {
        if (!mounted) return;
        setState(() {
          _isDownloading = false;
          _downloadError = 'Download error: $error';
        });
      });
    } catch (e) {
      setState(() {
        _isDownloading = false;
        _downloadError = 'Failed to initiate update: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          const Icon(Icons.new_releases_rounded, color: Colors.indigoAccent, size: 28),
          const SizedBox(width: 10),
          const Text('New Update Available'),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: Colors.indigoAccent.withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Installed',
                          style: TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'v${widget.updateInfo.currentVersion}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_rounded, color: Colors.indigoAccent, size: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'New Release',
                          style: TextStyle(fontSize: 11, color: Colors.indigoAccent),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'v${widget.updateInfo.latestVersion}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: Colors.indigoAccent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Changelog / What\'s New:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                widget.updateInfo.releaseNotes,
                style: const TextStyle(fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),
            if (_isDownloading) ...[
              const Text(
                'Downloading APK...',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: _progressPercentage > 0 ? _progressPercentage : null,
                borderRadius: BorderRadius.circular(8),
                minHeight: 8,
              ),
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  _downloadProgressText,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
            ],
            if (_downloadError != null) ...[
              const SizedBox(height: 12),
              Text(
                _downloadError!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
      actions: [
        if (!_isDownloading) ...[
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Later'),
          ),
          if (widget.updateInfo.htmlUrl.isNotEmpty)
            TextButton.icon(
              icon: const Icon(Icons.open_in_browser_rounded, size: 16),
              label: const Text('Web Download'),
              onPressed: () {
                UpdateService.openReleaseWebpage(widget.updateInfo.htmlUrl);
              },
            ),
          ElevatedButton.icon(
            icon: const Icon(Icons.download_rounded),
            label: const Text('Update Now'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.indigoAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: _startDownload,
          ),
        ] else ...[
          TextButton(
            onPressed: () {
              _otaSubscription?.cancel();
              setState(() {
                _isDownloading = false;
              });
            },
            child: const Text('Cancel Download'),
          ),
        ],
      ],
    );
  }
}
