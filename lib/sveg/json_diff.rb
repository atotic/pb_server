# json_diff.rb

# json_diff reimplements javascript JsonPath (public/js/diff.js)
# Look at javascript code for detailed docs
module PB

	class JsonPathProxy
		def initialize(obj, prop, path)
			@obj = obj
			@prop = prop
			@path = path
		end

		def to_s
			"#{@path}: #{self.val}"
		end

		def val
			if defined? @prop
				return @obj[@prop.to_i] if @obj.kind_of? Array
				return @obj[@prop]
			end
			@obj
		end

		# property name
		def prop
			@prop
		end

		# path to the property
		def path
			r = @path.join('.')
			r += ".#{@prop}" if defined? @prop
			r
		end

		def set(newVal)
			if defined? @prop
				return @obj[@prop.to_i] = newVal if @obj.kind_of? Array
				return @obj[@prop] = newVal
			end
			raise "Can't set root object"
		end

		def insert(newVal)
			if @obj.kind_of? Array
				@obj.insert(@prop.to_i, newVal)
			else
				self.set(newVal)
			end
		end

		def delete
			if defined? @prop
				if @obj.kind_of? Array
					@obj.slice! @prop.to_i
				else
					@obj.delete @prop
				end
			else
				raise "Can't delete root object";
			end
		end
	end

	class JsonPath

		def self.getType(obj)
			if obj.kind_of? Array
				:Array
			elsif obj.kind_of? Hash
				:Object
			else
				:Basic
			end
		end

		def self.array_clone_push(arry, element)
			([].concat arry).push(element)
		end

		def self.traverse(obj, path_array, path_to_here, options)
			el = [];
			if (path_array.length == 0)
				return nil
			elsif path_array.length == 1  # leaf, return values
				if path_array[0].eql? "$" # $
					el.push JsonPathProxy.new(obj, null, path_to_here)
				elsif path_array[0].eql? "*" # *
					case getType(obj)
					when :Array
						0.upto(obj.length-1) { |i| el.push JsonPathProxy.new(obj, i, path_to_here)}
					when :Object
						obj.keys.each { |propName| el.push JsonPathProxy.new(obj, propName, path_to_here)}
					when :Basic
						raise "Nothing to traverse at" + path_to_here.join('.') + '.*';
					end
				else # common case, leaf property
					type = getType(obj)
					if (options[:ghost_props] \
						|| (type == :Object && obj.has_key?( path_array[0] )) \
						|| (type == :Array && obj.length > path_array[0].to_i) \
						)
						el.push(JsonPathProxy.new(obj, path_array[0], path_to_here))
					end
				end
			else # branch, keep on traversing
				if path_array[0] == "$"
					el = traverse(obj,
						path_array.slice(1..-1),
						array_clone_push(path_to_here, path_array[0]),
						options);
				elsif path_array[0] == "*"
					case getType(obj)
					when :Array
						trim_path = path_array.slice(1..-1)
						0.upto(obj.length-1) do |i|
							el.concat(
								traverse(obj[i],
								 trim_path,
								 self.array_clone_push(path_to_here, i),
								 options))
						end
					when :Object
						trim_path = path_array.slice(1..-1)
						obj.keys.each do |propName|
							el = el.concat(
								traverse( obj[propName],
											trim_path,
											array_clone_push(path_to_here, propName),
											options))
						end
					when :Basic
						raise 'nothing to traverse at' + path_to_here.join('.') + ".*"
					end
				else
					o2 = obj[path_array[0]]
					el = traverse(o2,
						path_array.slice(1..-1),
						array_clone_push(path_to_here, path_array[0]),
						options) if o2
				end
			end
			return el
		end

		def self.canonical_path(path)
			raise "path cannot be null" unless path
			p = path.gsub(/\./, ';') # a.b => a;b
			p = p.gsub(/\[/, ';['); # p[2] => p;[2]
			p = p.gsub(/\[([^\]]+)\]/, '\1'); # [2] => 2
			p.split ';'
		end

		def self.query(obj, path, options=nil)
			options = {
				:just_one => false,
				:ghost_props => false
				}.merge(options || {})
			c_path = canonical_path(path)

			retVal = traverse(obj, c_path, [], options)
			if options[:just_one]
				raise "Multiple arguments returned, just_one requested" if retVal.length > 1
				return retVal.length == 0 ? nil : retVal[0]
			end
			retVal
		end
	end

	class JsonDiff

	def self.printDiff(diff)
		if diff.kind_of? Array
			diff.each { |d| printDiff(d)}
		else
			puts diff['path'], " ", diff['op'], " ", diff['args']
		end
		return ""
	end

	def self.applyDiff(obj, diff)
		case diff['op']
		when 'set'
			target = JsonPath.query(obj, diff['path'], {:just_one => true, :ghost_props => true})
			if target
				target.set diff['args']
			else
				raise "Could not SET, target #{diff['path']} not found"
			end
		when 'insert'
			target = JsonPath.query(obj, diff['path'], {:just_one => true, :ghost_props => true})
			if target
				target.insert diff['args']
			else
				raise "Could not INSERT, target #{diff['path']} not found";
			end
		when 'delete'
			target = JsonPath.query(obj, diff['path'], {:just_one => true})
			if target
				target.delete();
			else
				raise "Could not DELETE, target #{diff['path']} not found"
			end
		when 'swap'
			src = JsonPath.query(obj, diff['path'], {:just_one => true});
			dest = JsonPath.query(obj, diff['args'], {:just_one => true});
			if (src && dest)
				tmp = src.val()
				src.set(dest.val())
				dest.set(tmp)
			else
				raise "Could not MOVE #{src ? '' : diff['path'] + 'not found'} #{dest ? '' : diff['args'] + 'not found'}"
			end
		else
			raise "Unknown operation " + diff['op'];
		end
	end

	def self.patch(obj, diff)
		newObj = JSON.parse(JSON.generate obj)
		diff = JSON.parse(JSON.generate(diff)) # clone the diff because we do not want to modify original
		0.upto(diff.length-1) do |i|
			begin
				applyDiff(newObj, diff[i])
			rescue => e
				printDiff(diff[i])
				raise "Patch failed #{e.message}"
			end
		end
		newObj
	end

	end
end
