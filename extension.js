/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {
  Extension,
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const extensionObject = Extension.lookupByURL(import.meta.url);

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init(metadata) {
      super._init(0.0, _('Yandex Disk Status'));

      this.errorIconPath = `${metadata.path}/ya-disk-error.svg`;
      this.idleIconPath = `${metadata.path}/ya-disk-idle.svg`;
      this.indexIconPath = `${metadata.path}/ya-disk-index.svg`;

      this.icon = new St.Icon({style_class: 'ya-disk-status-icon'});
      this.icon.gicon = Gio.icon_new_for_string(this.errorIconPath);
      this.add_child(this.icon);

      this.statusChangeItem = new PopupMenu.PopupMenuItem(_('Stop'));
      this.menu.addMenuItem(this.statusChangeItem);

      this.statusChangeItem.connect('activate', () => {
        this.getStatus()
          .then(result => {
            console.log('[YaDiskStatus]', 'activate status');
            let changeStatusCmd = ['yandex-disk'];

            if (result.message.includes('idle')) {
              changeStatusCmd.push('stop');
            } else {
              changeStatusCmd.push('start');
            }

            const proc = Gio.Subprocess.new(changeStatusCmd, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, null, async (sucprocess, result) => {
              const [stdout, stderr] = proc.communicate_utf8_finish(result);
              this.refresh();
            });
          });
      });

      this.itemStatus = new PopupMenu.PopupMenuItem('', {
        reactive: false,
        can_focus: false,
        hover: false,
        style_class: 'ya-disk-status-message',
      });
      this.menu.addMenuItem(this.itemStatus);
    }

    refresh() {
      console.log('[YaDiskStatus]', 'refresh');
      this.getStatus()
        .then(result => {
          this.itemStatus.label.text = result.message;
          this.statusChangeItem.label.text = _('Start');
          this.icon.gicon = Gio.icon_new_for_string(this.errorIconPath);
          console.log('[YaDiskStatus]', result);
          if (result.message.includes('idle')) {
            this.icon.gicon = Gio.icon_new_for_string(this.idleIconPath);
            this.statusChangeItem.label.text = _('Stop');
          }
          if (result.message.includes('index')) {
            this.icon.gicon = Gio.icon_new_for_string(this.indexIconPath);
          }
        });
    }

    getStatus() {
      return new Promise((resolve, reject) => {
        const proc = Gio.Subprocess.new(['yandex-disk', 'status'],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

        proc.communicate_utf8_async(null, null, (sucprocess, result, data) => {
          const [stdout, stderr] = proc.communicate_utf8_finish(result);
          resolve({
            'result': stdout,
            'message': stderr,
          });
        });
      });
    }
  });

export default class IndicatorExampleExtension extends Extension {
  enable() {
    this._indicator = new Indicator(this.metadata);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    this._indicator.refresh();
    this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
      this._indicator.refresh();

      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    if (this._sourceId) {
      GLib.Source.remove(this._sourceId);
      this._sourceId = null;
    }

    this._indicator.destroy();
    this._indicator = null;
  }
}
