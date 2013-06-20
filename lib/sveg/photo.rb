require 'sequel'
require 'fileutils'
require 'digest/md5'

module PB
#
# Photo represents photos in our system
#
class Photo < Sequel::Model(:photos)

#	property :display_name,	String
#	property :storage,			String # where is the image stored locally
#	property :md5,					String # md5 hash

	plugin :timestamps

	many_to_one :user
	many_to_many :books

	DISPLAY_SIZE = 1024
	ICON_SIZE = 128

	def to_json(*a)
		{
			:id => self.id,
			:display_name => self.display_name,
			:date_taken => self.date_taken,
			:caption => self.caption,
			:faces => JSON.parse(self.faces || "[]"),
			:original_url => self.original_file ? self.url(:original) : false,
			:original_w => self.original_file_width,
			:original_h => self.original_file_height,
			:display_url => self.display_file ? self.url(:display) : false,
			:display_w => self.display_file_width,
			:display_h => self.display_file_height,
			:icon_url => self.icon_file ? self.url(:icon) : false,
			:icon_w => self.icon_file_width,
			:icon_h => self.icon_file_height
		}.to_json(*a)
	end

	def url(size)
		url = "/photo/#{self.pk}"
		size = size.to_sym if size
		case size
			when :icon then url += ".icon"
			when :display then url += ".display"
			else
		end
		url
	end

	def file_path(*size_arg) # call with no args for full size, or specify size as 'icon'|'display'
		size = size_arg[0]
		size = :original unless size
		size = size.to_sym
		path = case size
			when :icon then self.icon_file
			when :display then self.display_file
			else self.original_file
		end
		raise "no such file" unless path
		File.join( PhotoStorage.get_user_dir(self), path )
	end

	def before_destroy
		PB.logger.info("destroying photo #{self.pk}#{self.display_name}")
		PhotoStorage.destroyFile self
	end
end

# Photos are stored inside SvegSettings.photo_dir/:user_id/:photo_id.img
#
class PhotoStorage
	# stores the uploaded file, and updates

	def self.get_user_dir(photo)
		dir = File.join(SvegSettings.photo_dir, photo.user_id.to_s)
		FileUtils.mkdir_p(dir)
		dir
	end

	def self.auto_orient(path)
		# ImageMagick takes 1.3s to start up, so we query with gm to see if rotation is necessary
		cmd_query = "#{SvegSettings.graphicsmagick_binary} identify \"#{path}\" -format \"%[EXIF:Orientation]\""
		result  = `#{cmd_query}`.chomp
		raise ("Could not query orientation " + $?.to_s) unless $? == 0
		return if (result.eql?("unknown") || result.eql?("1")) # photo property oriented
		PB.logger.info("auto-orienting image")
# would like to use GraphicsMagick after all, see http://stackoverflow.com/questions/4263758/does-graphicsmagick-have-an-equivalent-to-imagemagick-convert-auto-orient-opt
#		transformation = case
#			when result.eql?("2") then "-flip horizontal"
#			when result.eql?("3") then "-rotate 180"
#			when result.eql?("4") then "-flip vertical"
#			when result.eql?("5") then "-transpose"
#			when result.eql?("6") then "-rotate 90"
#			when result.eql?("7") then "-transverse"
#			when result.eql?("8") then "-rotate 270"
#			else ""
#		end
#		cmd_line = "#{SvegSettings.graphicsmagick_binary} convert \"#{path}\""
# would need tool like exiv2 to set exif data, it'll probably shave off a second, and remove imagemagick dependency
		cmd_line = "#{SvegSettings.convert_binary} -auto-orient \"#{path}\"  \"#{path}\""
		success = Kernel.system cmd_line
		raise("Photo orient failed" + $?.to_s) unless success
	end

	def self.get_cmd_resize(size, src, dest)
		cmd_line = "#{SvegSettings.graphicsmagick_binary} convert"
		cmd_line += " -size #{size}X#{size} #{src} +profile \"*\""
		cmd_line += " -geometry #{size}X#{size} #{dest}"
		cmd_line
	end

	# conversts photo to various sizes
	# src: photo file path
	# sizes: { 128 => :icon, 1024 => :display }
	# returns: array of new files
	def self.multi_resize(src, sizes)
		src = File.expand_path(src)

		ext = File.extname(src)
		basename = File.basename(src, ext)
		dirname = File.dirname(src)
		ext = ext.downcase

		resized_files = {}
		keys = sizes.keys.sort.reverse
		cmd_line =  "#{SvegSettings.graphicsmagick_binary} convert"
		# read in file, remove exif data
		cmd_line += " -size #{keys.first}X#{keys.first} #{src} +profile \"*\""
		0.upto(keys.length - 1) do |i|
			filename = "#{basename}_#{sizes[keys[i]].to_s}#{ext}"
			dest_name = "#{dirname}/#{filename}"
			resized_files[keys[i]] = filename
			next if File.exists? dest_name
			cmd_line += "  -geometry \"#{(keys[i] * 1.34).to_i}X#{keys[i]}>\" -write #{dest_name}"
		end
		filename = "#{basename}_#{sizes[keys.last].to_s}#{ext}"
		dest_name = "#{dirname}/#{filename}"
		resized_files[keys.last] = filename
		unless File.exists? dest_name
			cmd_line += " -geometry \"#{(keys.last * 1.34).to_i}X#{keys.last}>\" #{dest_name}"
		end

		if cmd_line.match(/geometry/) # there is something to convert
			success = Kernel.system cmd_line
			raise("Photo resize failed" + $?.to_s) unless success
		end

		return resized_files
	end

	def self.get_size(file_path)
		file_path = File.expand_path(file_path)
		out = `#{SvegSettings.graphicsmagick_binary} identify -format "%wX%h" #{file_path}`
		PB.logger.warn "Could not get size #{file_path}" unless $?.to_i == 0
		size_data = out.chomp.split('X')
		return [ size_data[0].to_i,size_data[1].to_i ]
	end

	def self.resize(photo)
		src = File.expand_path(photo.file_path)
		file_names = self.multi_resize(src, { Photo::ICON_SIZE => :icon, Photo::DISPLAY_SIZE => :display })
		photo.icon_file = file_names[Photo::ICON_SIZE] if file_names[Photo::ICON_SIZE]
		photo.icon_file_width, photo.icon_file_height = self.get_size(photo.file_path(:icon)) if photo.icon_file
		photo.display_file = file_names[Photo::DISPLAY_SIZE] if file_names[Photo::DISPLAY_SIZE]
		photo.display_file_width, photo.display_file_height = self.get_size(photo.file_path(:display)) if photo.display_file
	end

	def self.read_exif_data(file_path)
		file_path = File.expand_path(file_path)
		exif_tokens = {
			:date_time_original => 'Exif.Photo.DateTimeOriginal',
			:date_time => 'Exif.Image.DateTime',
#			:user_comment => 'Exif.Photo.UserComment',
			:description => 'Xmp.dc.description',
			:title => 'Xmp.dc.title'
		}
		retVal = {}
		cmd_line = "#{SvegSettings.exiv2_binary} -Pkv " + exif_tokens.values.map { |x| "-g #{x} "}.join
		out = `#{cmd_line} #{file_path}`
#		PB.logger.warn "Could not read exif data #{file_path}" unless $?.to_i == 0
		out.split(/\n/).each do |line|
			match = line.match(/(\S+)(\s+)(.*)/)
			PB.logger.warn "Could not parse exif line #{line}" if match.length != 4
			key = exif_tokens.key( match[1] )
			if key
				retVal[key] = match[3]
				langMatch = retVal[key].match(/lang="([^"]+)"(.*)/)
				retVal[key] = langMatch[2] if langMatch
				retVal[key] = retVal[key].lstrip
			end
			PB.logger.warn "Unexpected, unknown key #{match[1]}" unless key
		end
		retVal
	end

	def self.face_detect(photo)
		file_path = photo.file_path(:display)
		cmd_line = "#{SvegSettings.python_binary} #{SvegSettings.face_script} #{file_path}"
		photo.faces = `#{cmd_line}`
	end

	def self.store_file(photo, file_path)
		raise "Photo must have a primary key" unless photo.pk
		dir = self.get_user_dir(photo)
		ext = File.extname( photo.display_name ).downcase
		ext = ".img" unless [".jpg", ".gif", ".png"].index(ext)
		destName = photo.id.to_s + ext
		dest = File.join(dir, destName)
		FileUtils.mv(file_path, dest)
		photo.md5 = Digest::MD5.hexdigest(File.read(dest))
		photo.original_file = destName
		# file post-processing: orient, and generate sizes
		self.auto_orient(dest)
		exif = self.read_exif_data(photo.file_path)
		photo.date_taken = (exif[:date_time_original] || exif[:date_time] || "")[0, 64]
		photo.caption = (exif[:description] || exif[:title] || "")[0,255]
		photo.original_file_width, photo.original_file_height = self.get_size(photo.file_path)
		self.resize(photo)
#		self.face_detect(photo)
		photo.save
	end

	def self.destroyFile(photo)
		begin
			File.delete(photo.file_path(:original))
		rescue => ex
			PB.logger.error "Could not destroy file #{photo.file_path} " + ex.message
		end
		begin
			File.delete(photo.file_path(:icon))
		rescue
		end
		begin
			File.delete(photo.file_path(:display))
		rescue
		end
		photo.original_file = nil
		photo.icon_file = nil
		photo.display_file = nil
		PB.logger.info("photo file deleted")
	end

end

end
