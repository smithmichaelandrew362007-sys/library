import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:ota_update/ota_update.dart';
import 'package:url_launcher/url_launcher.dart';

class UpdateInfo {
  final String currentVersion;
  final String latestVersion;
  final String releaseNotes;
  final String apkUrl;
  final String htmlUrl;
  final bool hasUpdate;

  UpdateInfo({
    required this.currentVersion,
    required this.latestVersion,
    required this.releaseNotes,
    required this.apkUrl,
    required this.htmlUrl,
    required this.hasUpdate,
  });
}

class UpdateService {
  static const String _repoOwner = 'smithmichaelandrew362007-sys';
  static const String _repoName = 'library';
  static const String _releasesUrl =
      'https://api.github.com/repos/$_repoOwner/$_repoName/releases/latest';

  /// Check GitHub API for the latest release
  static Future<UpdateInfo> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final String currentVerStr = packageInfo.version;

      final response = await http.get(
        Uri.parse(_releasesUrl),
        headers: {'Accept': 'application/vnd.github.v3+json'},
      );

      if (response.statusCode != 200) {
        throw Exception(
            'Failed to fetch latest release (HTTP ${response.statusCode})');
      }

      final Map<String, dynamic> data = json.decode(response.body);
      final String tagName = data['tag_name'] ?? '';
      final String latestVerStr = tagName.replaceAll(RegExp(r'^[vV]'), '').trim();
      final String releaseNotes = data['body'] ?? 'No release notes provided.';
      final String htmlUrl = data['html_url'] ?? '';

      String apkUrl = '';
      final List<dynamic> assets = data['assets'] ?? [];
      for (var asset in assets) {
        final String name = asset['name'] ?? '';
        if (name.endsWith('.apk')) {
          apkUrl = asset['browser_download_url'] ?? '';
          break;
        }
      }

      final bool isNewer = _isVersionNewer(currentVerStr, latestVerStr);

      return UpdateInfo(
        currentVersion: currentVerStr,
        latestVersion: latestVerStr.isEmpty ? currentVerStr : latestVerStr,
        releaseNotes: releaseNotes,
        apkUrl: apkUrl,
        htmlUrl: htmlUrl,
        hasUpdate: isNewer && apkUrl.isNotEmpty,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Error checking for update: $e');
      }
      rethrow;
    }
  }

  /// Simple semver comparison helper (e.g. "1.0.1" > "1.0.0")
  static bool _isVersionNewer(String current, String latest) {
    if (latest.isEmpty) return false;
    try {
      final List<int> currentParts =
          current.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      final List<int> latestParts =
          latest.split('.').map((e) => int.tryParse(e) ?? 0).toList();

      final int maxLen =
          currentParts.length > latestParts.length ? currentParts.length : latestParts.length;

      for (int i = 0; i < maxLen; i++) {
        final int c = i < currentParts.length ? currentParts[i] : 0;
        final int l = i < latestParts.length ? latestParts[i] : 0;
        if (l > c) return true;
        if (l < c) return false;
      }
    } catch (_) {
      return latest != current;
    }
    return false;
  }

  /// Download and launch native APK installer on Android
  static Stream<OtaEvent> downloadAndInstallApk(String apkUrl) {
    return OtaUpdate().execute(
      apkUrl,
      destinationFilename: 'libravault_update.apk',
    );
  }

  /// Open release page in external browser (fallback)
  static Future<bool> openReleaseWebpage(String url) async {
    final Uri uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return false;
  }
}
